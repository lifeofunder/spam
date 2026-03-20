import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { StripeClientService } from './stripe-client.service';

@Injectable()
export class StripeCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeClientService,
    private readonly config: ConfigService,
  ) {}

  private billingUrls() {
    const success =
      this.config.get<string>('STRIPE_SUCCESS_URL')?.trim() ||
      `${this.config.get<string>('PUBLIC_WEB_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'}/dashboard/billing?checkout=success`;
    const cancel =
      this.config.get<string>('STRIPE_CANCEL_URL')?.trim() ||
      `${this.config.get<string>('PUBLIC_WEB_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'}/dashboard/billing?checkout=cancel`;
    return { success, cancel };
  }

  async createProCheckoutSession(workspaceId: string, customerEmail: string): Promise<{ url: string }> {
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }
    const priceId = this.config.get<string>('STRIPE_PRICE_PRO_MONTHLY')?.trim();
    if (!priceId) {
      throw new BadRequestException('STRIPE_PRICE_PRO_MONTHLY is not set');
    }

    const { success, cancel } = this.billingUrls();

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { stripeCustomerId: true },
    });

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.client.customers.create({
        email: customerEmail,
        metadata: { workspaceId },
      });
      customerId = customer.id;
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      client_reference_id: workspaceId,
      metadata: { workspaceId },
      subscription_data: {
        metadata: { workspaceId },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }
    return { url: session.url };
  }

  async createBillingPortalSession(workspaceId: string): Promise<{ url: string }> {
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { stripeCustomerId: true },
    });
    if (!workspace.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer for this workspace yet');
    }
    const returnUrl =
      this.config.get<string>('STRIPE_PORTAL_RETURN_URL')?.trim() ||
      `${this.config.get<string>('PUBLIC_WEB_URL')?.replace(/\/$/, '') ?? 'http://localhost:3000'}/dashboard/billing`;

    const session = await this.stripe.client.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }
}
