import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PlanKey, Prisma, SequenceStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { limitsForPlan } from './plans.config';
import { UsageService } from './usage.service';

const WORKSPACE_BILLING_SELECT = {
  planKey: true,
  subscriptionStatus: true,
} satisfies Prisma.WorkspaceSelect;

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  private paymentRequired(message: string, extra?: Record<string, unknown>): never {
    throw new HttpException({ message, ...(extra ?? {}) }, HttpStatus.PAYMENT_REQUIRED);
  }

  /** Effective plan for quotas (PRO while subscription exists; PAST_DUE still uses PRO limits until resolved). */
  effectivePlanKey(row: { planKey: PlanKey; subscriptionStatus: SubscriptionStatus }): PlanKey {
    if (row.planKey !== PlanKey.PRO) {
      return PlanKey.FREE;
    }
    if (
      row.subscriptionStatus === SubscriptionStatus.ACTIVE ||
      row.subscriptionStatus === SubscriptionStatus.PAST_DUE
    ) {
      return PlanKey.PRO;
    }
    return PlanKey.FREE;
  }

  async getLimits(workspaceId: string) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: WORKSPACE_BILLING_SELECT,
    });
    const plan = this.effectivePlanKey(ws);
    return limitsForPlan(plan);
  }

  async assertNotPastDue(workspaceId: string): Promise<void> {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { subscriptionStatus: true },
    });
    if (ws.subscriptionStatus === SubscriptionStatus.PAST_DUE) {
      this.paymentRequired('Subscription is past due. Update your payment method in Billing.', {
        code: 'BILLING_PAST_DUE',
      });
    }
  }

  /**
   * Blocks marketing writes when the account is past due (campaigns, sequences, sends, imports).
   */
  async assertMarketingAllowed(workspaceId: string): Promise<void> {
    await this.assertNotPastDue(workspaceId);
  }

  async assertCanCreateContacts(workspaceId: string, newContactCount: number): Promise<void> {
    if (newContactCount <= 0) {
      return;
    }
    await this.assertMarketingAllowed(workspaceId);
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: WORKSPACE_BILLING_SELECT,
    });
    const limits = limitsForPlan(this.effectivePlanKey(ws));
    const current = await this.prisma.contact.count({ where: { workspaceId } });
    if (current + newContactCount > limits.maxContacts) {
      this.paymentRequired('Contact limit exceeded for your plan.', {
        code: 'LIMIT_CONTACTS',
        limit: limits.maxContacts,
        current,
        requested: newContactCount,
      });
    }
  }

  async assertCanSendEmail(workspaceId: string): Promise<void> {
    await this.assertCanSendEmails(workspaceId, 1);
  }

  async assertCanSendEmails(workspaceId: string, count: number): Promise<void> {
    if (count <= 0) {
      return;
    }
    await this.assertMarketingAllowed(workspaceId);
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: WORKSPACE_BILLING_SELECT,
    });
    const limits = limitsForPlan(this.effectivePlanKey(ws));
    const used = await this.usage.getEmailsSentThisMonth(workspaceId);
    if (used + count > limits.maxEmailsPerMonth) {
      this.paymentRequired('Monthly email send limit exceeded for your plan.', {
        code: 'LIMIT_EMAILS_MONTH',
        limit: limits.maxEmailsPerMonth,
        used,
        requested: count,
      });
    }
  }

  async assertCanActivateSequence(workspaceId: string): Promise<void> {
    await this.assertMarketingAllowed(workspaceId);
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: WORKSPACE_BILLING_SELECT,
    });
    const limits = limitsForPlan(this.effectivePlanKey(ws));
    const active = await this.prisma.sequence.count({
      where: { workspaceId, status: SequenceStatus.ACTIVE },
    });
    if (active + 1 > limits.maxActiveSequences) {
      this.paymentRequired('Active sequence limit exceeded for your plan.', {
        code: 'LIMIT_ACTIVE_SEQUENCES',
        limit: limits.maxActiveSequences,
        current: active,
      });
    }
  }
}
