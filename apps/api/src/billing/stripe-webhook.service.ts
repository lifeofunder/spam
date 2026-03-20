import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanKey, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import Stripe from 'stripe';
import { PrismaService } from '../prisma.service';
import { StripeClientService } from './stripe-client.service';

function maskPayloadForLog(payload: unknown): { id?: string; type?: string } {
  if (payload && typeof payload === 'object' && 'id' in payload && 'type' in payload) {
    const o = payload as { id?: string; type?: string };
    return { id: o.id, type: o.type };
  }
  return {};
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'unpaid':
      return SubscriptionStatus.PAST_DUE;
    case 'incomplete':
    case 'incomplete_expired':
      return SubscriptionStatus.INCOMPLETE;
    case 'paused':
      return SubscriptionStatus.PAST_DUE;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

function subscriptionToWorkspaceData(sub: Stripe.Subscription): {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  subscriptionStatus: SubscriptionStatus;
  planKey: PlanKey;
  currentPeriodEnd: Date | null;
} {
  const status = mapStripeSubscriptionStatus(sub.status);
  const pro =
    sub.status === 'active' ||
    sub.status === 'trialing' ||
    sub.status === 'past_due' ||
    sub.status === 'unpaid' ||
    sub.status === 'paused';
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const periodEndSec = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    subscriptionStatus: status,
    planKey: pro ? PlanKey.PRO : PlanKey.FREE,
    currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
  };
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeClientService,
    private readonly config: ConfigService,
  ) {}

  verifyAndParse(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    if (!this.stripe.isConfigured()) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    return this.stripe.client.webhooks.constructEvent(rawBody, signature, secret);
  }

  async processEvent(event: Stripe.Event): Promise<void> {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isProd) {
      this.logger.log(`Stripe webhook ${event.type} id=${event.id}`);
    } else {
      this.logger.log(`Stripe webhook ${event.type} id=${event.id} ${JSON.stringify(maskPayloadForLog(event))}`);
    }

    const payloadJson = JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;

    let row = await this.prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (row?.processedAt) {
      return;
    }

    if (!row) {
      try {
        await this.prisma.stripeWebhookEvent.create({
          data: {
            stripeEventId: event.id,
            type: event.type,
            payload: payloadJson,
          },
        });
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          row = await this.prisma.stripeWebhookEvent.findUnique({
            where: { stripeEventId: event.id },
          });
          if (row?.processedAt) {
            return;
          }
        } else {
          throw e;
        }
      }
    }

    try {
      await this.dispatch(event);
      await this.prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Stripe webhook handler failed for ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  private async findWorkspaceIdForSubscription(sub: Stripe.Subscription): Promise<string | null> {
    const meta = sub.metadata?.workspaceId;
    if (meta) {
      return meta;
    }
    const row = await this.prisma.workspace.findFirst({
      where: { stripeSubscriptionId: sub.id },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        return;
      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        return;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        return;
      case 'invoice.paid':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        return;
      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        return;
      default:
        this.logger.debug(`Stripe webhook unhandled type: ${event.type}`);
    }
  }

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const workspaceId = session.metadata?.workspaceId ?? session.client_reference_id ?? undefined;
    const subId = session.subscription;
    if (!workspaceId || typeof subId !== 'string') {
      this.logger.warn('checkout.session.completed missing workspaceId or subscription');
      return;
    }
    const sub = await this.stripe.client.subscriptions.retrieve(subId);
    const data = subscriptionToWorkspaceData(sub);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...data,
        stripeCustomerId: data.stripeCustomerId,
      },
    });
  }

  private async onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const workspaceId = await this.findWorkspaceIdForSubscription(sub);
    if (!workspaceId) {
      this.logger.warn(`subscription.updated: no workspace for subscription ${sub.id}`);
      return;
    }
    const data = subscriptionToWorkspaceData(sub);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const res = await this.prisma.workspace.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        stripeSubscriptionId: null,
        subscriptionStatus: SubscriptionStatus.CANCELED,
        planKey: PlanKey.FREE,
        currentPeriodEnd: null,
      },
    });
    if (res.count === 0) {
      this.logger.warn(`subscription.deleted: no workspace for subscription ${sub.id}`);
    }
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subId = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription;
    if (!subId || typeof subId !== 'string') {
      return;
    }
    const sub = await this.stripe.client.subscriptions.retrieve(subId);
    const workspaceId = await this.findWorkspaceIdForSubscription(sub);
    if (!workspaceId) {
      this.logger.warn(`invoice.paid: no workspace for subscription ${subId}`);
      return;
    }
    const data = subscriptionToWorkspaceData(sub);
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subId = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription;
    if (!subId || typeof subId !== 'string') {
      return;
    }
    await this.prisma.workspace.updateMany({
      where: { stripeSubscriptionId: subId },
      data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
    });
  }
}
