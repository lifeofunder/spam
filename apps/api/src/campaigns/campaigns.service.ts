import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  MessageEventStatus,
  Prisma,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { buildContactWhere } from '../common/contact-filter.util';
import { EntitlementsService } from '../billing/entitlements.service';
import { CampaignDispatchEnqueueService } from '../campaign-send/campaign-dispatch-enqueue.service';
import {
  CAMPAIGN_SCHEDULED_START_JOB_NAME,
  CAMPAIGN_SEND_QUEUE_TOKEN,
  campaignScheduleJobId,
} from '../campaign-send/campaign-send.constants';
import type { CampaignSendJobPayload } from '../campaign-send/campaign-send.types';
import { PrismaService } from '../prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ScheduleCampaignDto } from './dto/schedule-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const MIN_SCHEDULE_LEAD_MS = 15_000;

const CAMPAIGN_LIST_SELECT = {
  id: true,
  name: true,
  status: true,
  templateId: true,
  query: true,
  tag: true,
  sendJobId: true,
  scheduleJobId: true,
  scheduledAt: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CampaignSelect;

type CampaignListRow = Prisma.CampaignGetPayload<{ select: typeof CAMPAIGN_LIST_SELECT }>;

type MessageStats = {
  queued: number;
  sent: number;
  failed: number;
};

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchEnqueue: CampaignDispatchEnqueueService,
    private readonly entitlements: EntitlementsService,
    @Inject(CAMPAIGN_SEND_QUEUE_TOKEN)
    private readonly campaignQueue: Queue<CampaignSendJobPayload>,
  ) {}

  private emptyStats(): MessageStats {
    return { queued: 0, sent: 0, failed: 0 };
  }

  private parseScheduledAt(raw: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO 8601 datetime (UTC recommended, e.g. …Z)');
    }
    return d;
  }

  private assertFutureScheduledAt(d: Date): void {
    if (d.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) {
      throw new BadRequestException(
        `scheduledAt must be at least ${MIN_SCHEDULE_LEAD_MS / 1000}s in the future (compared in UTC)`,
      );
    }
  }

  private async removeDelayedScheduleJob(campaignId: string): Promise<void> {
    const jobId = campaignScheduleJobId(campaignId);
    const job = await this.campaignQueue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  /**
   * Registers or replaces the delayed BullMQ job. Updates `scheduleJobId` and persists `scheduledAt`.
   */
  private async ensureDelayedScheduleJob(
    workspaceId: string,
    campaignId: string,
    scheduledAt: Date,
  ): Promise<{ scheduleJobId: string }> {
    this.assertFutureScheduledAt(scheduledAt);
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    const jobId = campaignScheduleJobId(campaignId);
    const existing = await this.campaignQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }

    try {
      const job = await this.campaignQueue.add(
        CAMPAIGN_SCHEDULED_START_JOB_NAME,
        { campaignId, workspaceId },
        {
          jobId,
          delay,
          attempts: 1,
          removeOnComplete: { age: 86_400 },
          removeOnFail: { age: 86_400 },
        },
      );
      const bullId = String(job.id ?? jobId);
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          scheduledAt,
          scheduleJobId: bullId,
        },
      });
      return { scheduleJobId: bullId };
    } catch (err) {
      await this.prisma.campaign.updateMany({
        where: { id: campaignId, workspaceId },
        data: { scheduleJobId: null },
      });
      throw err;
    }
  }

  private async loadStatsMap(
    workspaceId: string,
    campaignIds: string[],
  ): Promise<Map<string, MessageStats>> {
    const map = new Map<string, MessageStats>();
    for (const cid of campaignIds) {
      map.set(cid, this.emptyStats());
    }
    if (!campaignIds.length) {
      return map;
    }

    const rows = await this.prisma.messageEvent.groupBy({
      by: ['campaignId', 'status'],
      where: { workspaceId, campaignId: { in: campaignIds } },
      _count: { _all: true },
    });

    for (const row of rows) {
      const cid = row.campaignId;
      if (cid == null) {
        continue;
      }
      const cur = map.get(cid) ?? this.emptyStats();
      const n = row._count._all;
      if (row.status === MessageEventStatus.QUEUED) {
        cur.queued += n;
      } else if (row.status === MessageEventStatus.SENT) {
        cur.sent += n;
      } else if (row.status === MessageEventStatus.FAILED) {
        cur.failed += n;
      }
      map.set(cid, cur);
    }

    return map;
  }

  async create(workspaceId: string, dto: CreateCampaignDto) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: dto.templateId, workspaceId },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    let scheduledAt: Date | null = null;
    if (dto.scheduledAt != null && dto.scheduledAt !== '') {
      scheduledAt = this.parseScheduledAt(dto.scheduledAt);
      this.assertFutureScheduledAt(scheduledAt);
    }

    const row = await this.prisma.campaign.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        templateId: dto.templateId,
        query: dto.query?.trim() || null,
        tag: dto.tag?.trim() || null,
        status: CampaignStatus.DRAFT,
        scheduledAt,
      },
      select: CAMPAIGN_LIST_SELECT,
    });

    if (scheduledAt) {
      await this.ensureDelayedScheduleJob(workspaceId, row.id, scheduledAt);
      return this.prisma.campaign.findFirstOrThrow({
        where: { id: row.id },
        select: CAMPAIGN_LIST_SELECT,
      });
    }

    return row;
  }

  async update(workspaceId: string, id: string, dto: UpdateCampaignDto) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const existing = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      select: { status: true, templateId: true },
    });
    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }
    if (existing.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Only draft campaigns can be updated');
    }

    if (dto.templateId && dto.templateId !== existing.templateId) {
      const template = await this.prisma.emailTemplate.findFirst({
        where: { id: dto.templateId, workspaceId },
        select: { id: true },
      });
      if (!template) {
        throw new NotFoundException('Template not found');
      }
    }

    const data: Prisma.CampaignUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.templateId !== undefined) {
      data.template = { connect: { id: dto.templateId } };
    }
    if (dto.query !== undefined) {
      data.query = dto.query.trim() || null;
    }
    if (dto.tag !== undefined) {
      data.tag = dto.tag.trim() || null;
    }

    let scheduledAtForJob: Date | null | undefined;
    if (dto.scheduledAt !== undefined) {
      if (dto.scheduledAt === null || dto.scheduledAt === '') {
        await this.removeDelayedScheduleJob(id);
        data.scheduledAt = null;
        data.scheduleJobId = null;
        scheduledAtForJob = null;
      } else {
        const d = this.parseScheduledAt(dto.scheduledAt);
        this.assertFutureScheduledAt(d);
        data.scheduledAt = d;
        scheduledAtForJob = d;
      }
    }

    await this.prisma.campaign.update({
      where: { id },
      data,
    });

    if (scheduledAtForJob instanceof Date) {
      await this.ensureDelayedScheduleJob(workspaceId, id, scheduledAtForJob);
    }

    return this.prisma.campaign.findFirstOrThrow({
      where: { id, workspaceId },
      select: CAMPAIGN_LIST_SELECT,
    });
  }

  async schedule(workspaceId: string, id: string, dto: ScheduleCampaignDto) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      select: { status: true, scheduledAt: true },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Only draft campaigns can be scheduled');
    }

    let at: Date;
    if (dto.scheduledAt) {
      at = this.parseScheduledAt(dto.scheduledAt);
      this.assertFutureScheduledAt(at);
      await this.prisma.campaign.update({
        where: { id },
        data: { scheduledAt: at },
      });
    } else if (campaign.scheduledAt) {
      at = campaign.scheduledAt;
      this.assertFutureScheduledAt(at);
    } else {
      throw new BadRequestException('scheduledAt is required on the campaign or in the request body');
    }

    return this.ensureDelayedScheduleJob(workspaceId, id, at);
  }

  async cancelSchedule(workspaceId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      select: { status: true },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Only draft campaigns can cancel a schedule');
    }

    await this.removeDelayedScheduleJob(id);
    await this.prisma.campaign.update({
      where: { id },
      data: { scheduledAt: null, scheduleJobId: null },
    });

    return { ok: true as const };
  }

  async list(workspaceId: string) {
    const rows: CampaignListRow[] = await this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: CAMPAIGN_LIST_SELECT,
    });

    const statsMap = await this.loadStatsMap(
      workspaceId,
      rows.map((r) => r.id),
    );

    return rows.map((row) => ({
      ...row,
      messageStats: statsMap.get(row.id) ?? this.emptyStats(),
    }));
  }

  async getById(workspaceId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      select: {
        ...CAMPAIGN_LIST_SELECT,
        template: {
          select: { id: true, name: true, subject: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const statsMap = await this.loadStatsMap(workspaceId, [id]);
    const where = buildContactWhere(workspaceId, {
      query: campaign.query ?? undefined,
      tag: campaign.tag ?? undefined,
      subscribedOnly: true,
    });
    const audienceCount = await this.prisma.contact.count({ where });

    const { template, ...rest } = campaign;

    return {
      ...rest,
      template,
      messageStats: statsMap.get(id) ?? this.emptyStats(),
      subscribedAudienceCount: audienceCount,
    };
  }

  async getSendStatus(workspaceId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        status: true,
        sendJobId: true,
        sentAt: true,
        query: true,
        tag: true,
        scheduledAt: true,
        scheduleJobId: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const statsMap = await this.loadStatsMap(workspaceId, [id]);
    const where = buildContactWhere(workspaceId, {
      query: campaign.query ?? undefined,
      tag: campaign.tag ?? undefined,
      subscribedOnly: true,
    });
    const subscribedAudienceCount = await this.prisma.contact.count({ where });

    let jobState: string | null = null;
    let progress: { processed: number; total: number } | null = null;

    if (campaign.sendJobId && campaign.status === CampaignStatus.SENDING) {
      const job = await this.campaignQueue.getJob(campaign.sendJobId);
      if (job) {
        jobState = await job.getState();
        const raw = job.progress;
        if (
          raw &&
          typeof raw === 'object' &&
          'processed' in raw &&
          'total' in raw &&
          typeof (raw as { processed: unknown }).processed === 'number' &&
          typeof (raw as { total: unknown }).total === 'number'
        ) {
          progress = {
            processed: (raw as { processed: number }).processed,
            total: (raw as { total: number }).total,
          };
        }
      } else {
        jobState = 'unknown';
      }
    }

    let scheduleJobState: string | null = null;
    if (
      campaign.status === CampaignStatus.DRAFT &&
      campaign.scheduledAt &&
      campaign.scheduleJobId
    ) {
      const sj = await this.campaignQueue.getJob(campaignScheduleJobId(campaign.id));
      if (sj) {
        scheduleJobState = await sj.getState();
      } else {
        scheduleJobState = 'unknown';
      }
    }

    return {
      campaignId: campaign.id,
      campaignStatus: campaign.status,
      jobId: campaign.sendJobId,
      jobState,
      progress,
      scheduledAt: campaign.scheduledAt,
      scheduleJobId: campaign.scheduleJobId,
      scheduleJobState,
      messageStats: statsMap.get(id) ?? this.emptyStats(),
      subscribedAudienceCount,
      sentAt: campaign.sentAt,
    };
  }

  async sendNow(workspaceId: string, id: string) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const snap = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      select: { status: true, sendJobId: true },
    });

    if (!snap) {
      throw new NotFoundException('Campaign not found');
    }

    if (snap.status === CampaignStatus.SENDING) {
      return {
        jobId: snap.sendJobId ?? `campaign-send-${id}`,
        status: 'queued' as const,
      };
    }

    if (snap.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Campaign is not a draft');
    }

    await this.removeDelayedScheduleJob(id);
    await this.prisma.campaign.updateMany({
      where: { id, workspaceId },
      data: { scheduledAt: null, scheduleJobId: null },
    });

    return this.dispatchEnqueue.enqueueDispatch(workspaceId, id);
  }
}
