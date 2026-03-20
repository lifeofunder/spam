import { Injectable } from '@nestjs/common';
import { PlanKey, SequenceStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { limitsForPlan } from './plans.config';
import { utcMonthPeriodKey, UsageService } from './usage.service';

@Injectable()
export class BillingSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: UsageService,
  ) {}

  private limitsPlanKey(row: { planKey: PlanKey; subscriptionStatus: SubscriptionStatus }): PlanKey {
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

  async getSummary(workspaceId: string) {
    const ws = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        planKey: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    const periodKey = utcMonthPeriodKey();
    const [contactsCount, activeSequencesCount, emailsSentThisMonth] = await Promise.all([
      this.prisma.contact.count({ where: { workspaceId } }),
      this.prisma.sequence.count({ where: { workspaceId, status: SequenceStatus.ACTIVE } }),
      this.usage.getEmailsSentThisMonth(workspaceId, periodKey),
    ]);

    const limitsPlan = this.limitsPlanKey(ws);
    const limits = limitsForPlan(limitsPlan);

    return {
      planKey: ws.planKey,
      subscriptionStatus: ws.subscriptionStatus,
      currentPeriodEnd: ws.currentPeriodEnd,
      hasStripeCustomer: Boolean(ws.stripeCustomerId),
      hasStripeSubscription: Boolean(ws.stripeSubscriptionId),
      limitsPlanKey: limitsPlan,
      limits,
      usage: {
        contactsCount,
        activeSequencesCount,
        emailsSentThisMonth,
        usagePeriodKey: periodKey,
      },
    };
  }
}
