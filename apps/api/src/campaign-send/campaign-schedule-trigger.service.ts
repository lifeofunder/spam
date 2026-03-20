import { Injectable, Logger } from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma.service';
import { CampaignDispatchEnqueueService } from './campaign-dispatch-enqueue.service';
import type { CampaignSendJobPayload } from './campaign-send.types';

const SKEW_MS = 120_000;

/**
 * BullMQ processor for delayed `scheduled-start` jobs: enqueues the real dispatch job.
 */
@Injectable()
export class CampaignScheduleTriggerService {
  private readonly logger = new Logger(CampaignScheduleTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchEnqueue: CampaignDispatchEnqueueService,
  ) {}

  async process(job: Job<CampaignSendJobPayload>): Promise<void> {
    const { campaignId, workspaceId } = job.data;

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      select: { status: true, scheduledAt: true },
    });

    if (!campaign) {
      this.logger.warn(`scheduled-start: campaign ${campaignId} not found`);
      return;
    }

    if (campaign.status !== CampaignStatus.DRAFT) {
      await this.prisma.campaign.updateMany({
        where: { id: campaignId, workspaceId },
        data: { scheduledAt: null, scheduleJobId: null },
      });
      this.logger.warn(
        `scheduled-start noop: campaign ${campaignId} status=${campaign.status} (cleared stale schedule fields)`,
      );
      return;
    }

    if (!campaign.scheduledAt) {
      this.logger.warn(`scheduled-start noop: campaign ${campaignId} has no scheduledAt`);
      return;
    }

    const now = Date.now();
    if (campaign.scheduledAt.getTime() > now + SKEW_MS) {
      this.logger.warn(
        `scheduled-start noop: campaign ${campaignId} scheduledAt still far in the future (clock skew?)`,
      );
      return;
    }

    try {
      await this.dispatchEnqueue.enqueueDispatch(workspaceId, campaignId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`scheduled-start: failed to enqueue dispatch for ${campaignId}: ${msg}`);
      throw err;
    }
  }
}
