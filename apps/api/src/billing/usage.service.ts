import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/** UTC calendar month key: YYYY-MM */
export function utcMonthPeriodKey(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${m.toString().padStart(2, '0')}`;
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmailsSentThisMonth(workspaceId: string, periodKey = utcMonthPeriodKey()): Promise<number> {
    const row = await this.prisma.workspaceEmailUsage.findUnique({
      where: {
        workspaceId_periodKey: { workspaceId, periodKey },
      },
      select: { emailsSent: true },
    });
    return row?.emailsSent ?? 0;
  }

  /** Increments after a successful outbound send (campaign / sequence / test). */
  async recordEmailsSent(workspaceId: string, count: number, periodKey = utcMonthPeriodKey()): Promise<void> {
    if (count <= 0) {
      return;
    }
    await this.prisma.workspaceEmailUsage.upsert({
      where: {
        workspaceId_periodKey: { workspaceId, periodKey },
      },
      create: {
        workspaceId,
        periodKey,
        emailsSent: count,
      },
      update: {
        emailsSent: { increment: count },
      },
    });
  }
}
