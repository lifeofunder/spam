import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { buildContactWhere } from '../common/contact-filter.util';
import { EntitlementsService } from '../billing/entitlements.service';
import { PrismaService } from '../prisma.service';
import {
  CAMPAIGN_DISPATCH_JOB_NAME,
  CAMPAIGN_SEND_QUEUE_TOKEN,
  campaignDispatchJobId,
} from './campaign-send.constants';
import type { CampaignSendJobPayload } from './campaign-send.types';

/**
 * Enqueues the real campaign-send job (same pipeline as POST …/send-now).
 */
@Injectable()
export class CampaignDispatchEnqueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    @Inject(CAMPAIGN_SEND_QUEUE_TOKEN)
    private readonly campaignQueue: Queue<CampaignSendJobPayload>,
  ) {}

  async enqueueDispatch(workspaceId: string, campaignId: string): Promise<{ jobId: string }> {
    const snap = await this.prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      select: { status: true, sendJobId: true, query: true, tag: true },
    });

    if (!snap) {
      throw new NotFoundException('Campaign not found');
    }

    if (snap.status === CampaignStatus.SENDING) {
      return { jobId: snap.sendJobId ?? campaignDispatchJobId(campaignId) };
    }

    if (snap.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Campaign is not a draft');
    }

    const where = buildContactWhere(workspaceId, {
      query: snap.query ?? undefined,
      tag: snap.tag ?? undefined,
      subscribedOnly: true,
    });

    const contactCount = await this.prisma.contact.count({ where });
    if (!contactCount) {
      throw new BadRequestException('No subscribed contacts match this campaign filters');
    }

    await this.entitlements.assertCanSendEmails(workspaceId, contactCount);

    const updated = await this.prisma.campaign.updateMany({
      where: { id: campaignId, workspaceId, status: CampaignStatus.DRAFT },
      data: { status: CampaignStatus.SENDING },
    });

    if (updated.count === 0) {
      throw new ConflictException('Campaign could not be queued');
    }

    const jobId = campaignDispatchJobId(campaignId);

    try {
      const job = await this.campaignQueue.add(
        CAMPAIGN_DISPATCH_JOB_NAME,
        { campaignId, workspaceId },
        {
          jobId,
          attempts: 1,
          removeOnComplete: { age: 86_400 },
          removeOnFail: { age: 86_400 },
        },
      );

      const bullId = String(job.id ?? jobId);

      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          sendJobId: bullId,
          scheduledAt: null,
          scheduleJobId: null,
        },
      });

      return { jobId: bullId };
    } catch (err) {
      const existing = await this.campaignQueue.getJob(jobId);
      if (existing) {
        const bullId = String(existing.id ?? jobId);
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: {
            sendJobId: bullId,
            status: CampaignStatus.SENDING,
            scheduledAt: null,
            scheduleJobId: null,
          },
        });
        return { jobId: bullId };
      }

      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.DRAFT, sendJobId: null },
      });
      throw err;
    }
  }
}
