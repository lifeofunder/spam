import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignStatus, Contact, MessageEventStatus } from '@prisma/client';
import type { Job } from 'bullmq';
import type { CampaignSendJobPayload } from './campaign-send.types';
import { EntitlementsService } from '../billing/entitlements.service';
import { UsageService } from '../billing/usage.service';
import { buildContactWhere } from '../common/contact-filter.util';
import type { MailProvider } from '../mail/mail-provider.interface';
import { MAIL_PROVIDER, type SendMailResult } from '../mail/mail.types';
import { buildEmailWithCompliance } from '../mail/compliance-email.util';
import { PrismaService } from '../prisma.service';
import { createRateLimitRedis } from './bullmq-redis';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientSendError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket|timed out|429|temporar|4\.3\.\d/i.test(
    msg,
  );
}

@Injectable()
export class CampaignSendExecutor implements OnModuleDestroy {
  private readonly logger = new Logger(CampaignSendExecutor.name);
  private readonly redis = createRateLimitRedis();
  private redisClosed = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageService,
  ) {}

  private get batchSize(): number {
    return Math.max(1, Number(this.config.get('CAMPAIGN_BATCH_SIZE') ?? 25));
  }

  private get maxPerWorkspacePerMinute(): number {
    return Math.max(1, Number(this.config.get('CAMPAIGN_WORKSPACE_EMAILS_PER_MINUTE') ?? 120));
  }

  private get messageMaxRetries(): number {
    return Math.max(0, Number(this.config.get('CAMPAIGN_MESSAGE_MAX_RETRIES') ?? 3));
  }

  private get messageRetryBaseMs(): number {
    return Math.max(100, Number(this.config.get('CAMPAIGN_MESSAGE_RETRY_BASE_MS') ?? 2000));
  }

  private complianceOpts() {
    const secret = this.config.get<string>('UNSUBSCRIBE_SECRET');
    const publicWebUrl = this.config.get<string>('PUBLIC_WEB_URL');
    const ttlRaw = this.config.get<string>('UNSUBSCRIBE_TOKEN_TTL_DAYS');
    const ttlNum = ttlRaw ? Number(ttlRaw) : NaN;
    return {
      unsubscribeSecret: secret || undefined,
      publicWebUrl: publicWebUrl || undefined,
      unsubscribeTtlDays: Number.isFinite(ttlNum) && ttlNum > 0 ? ttlNum : undefined,
    };
  }

  /**
   * Simple per-workspace cap: sliding minute window via Redis INCR.
   */
  private async acquireWorkspaceSendSlot(workspaceId: string): Promise<void> {
    const key = `rl:campaign-send:${workspaceId}`;
    const max = this.maxPerWorkspacePerMinute;
    for (;;) {
      const n = await this.redis.incr(key);
      if (n === 1) {
        await this.redis.pexpire(key, 60_000);
      }
      if (n <= max) {
        return;
      }
      await this.redis.decr(key);
      await sleep(500);
    }
  }

  private async sendWithRetries(
    to: string,
    subject: string,
    html: string,
    text: string | undefined,
  ): Promise<SendMailResult> {
    const retries = this.messageMaxRetries;
    const base = this.messageRetryBaseMs;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.mail.send({ to, subject, html, text });
      } catch (err) {
        lastErr = err;
        const canRetry = attempt < retries && isTransientSendError(err);
        if (!canRetry) {
          throw err;
        }
        const delay = base * 2 ** attempt;
        this.logger.warn(`Transient mail error to ${to}, retry ${attempt + 1}/${retries} in ${delay}ms`);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  async processJob(job: Job<CampaignSendJobPayload>): Promise<void> {
    const { campaignId, workspaceId } = job.data;

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId },
      include: { template: true },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found, skip job`);
      return;
    }

    if (campaign.status !== CampaignStatus.SENDING) {
      this.logger.warn(`Campaign ${campaignId} status=${campaign.status}, skip job`);
      return;
    }

    const where = buildContactWhere(workspaceId, {
      query: campaign.query ?? undefined,
      tag: campaign.tag ?? undefined,
      subscribedOnly: true,
    });

    const total = await this.prisma.contact.count({ where });
    if (total === 0) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.DRAFT, sendJobId: null },
      });
      throw new Error('No subscribed contacts for campaign');
    }

    await job.updateProgress({ processed: 0, total });

    let processed = 0;
    let cursor: string | undefined;

    const template = campaign.template;

    while (true) {
      const batch: Contact[] = await this.prisma.contact.findMany({
        where,
        orderBy: { id: 'asc' },
        take: this.batchSize,
        ...(cursor
          ? {
              cursor: { id: cursor },
              skip: 1,
            }
          : {}),
      });

      if (!batch.length) {
        break;
      }

      for (const contact of batch) {
        const existing = await this.prisma.messageEvent.findFirst({
          where: {
            campaignId,
            contactId: contact.id,
            status: { in: [MessageEventStatus.SENT, MessageEventStatus.FAILED] },
          },
        });
        if (existing) {
          processed++;
          await job.updateProgress({ processed, total });
          continue;
        }

        try {
          await this.entitlements.assertCanSendEmail(workspaceId);
        } catch (err) {
          if (err instanceof HttpException && err.getStatus() === HttpStatus.PAYMENT_REQUIRED) {
            await this.markCampaignFailed(campaignId);
          }
          throw err;
        }

        await this.acquireWorkspaceSendSlot(workspaceId);

        const event = await this.prisma.messageEvent.create({
          data: {
            workspaceId,
            campaignId,
            contactId: contact.id,
            email: contact.email,
            status: MessageEventStatus.QUEUED,
          },
        });

        try {
          const { subject, html, text } = buildEmailWithCompliance(
            template.subject,
            template.html,
            template.text,
            contact,
            workspaceId,
            this.complianceOpts(),
          );

          const sendResult = await this.sendWithRetries(contact.email, subject, html, text);

          await this.prisma.messageEvent.update({
            where: { id: event.id },
            data: {
              status: MessageEventStatus.SENT,
              smtpMessageId: sendResult.smtpMessageId ?? undefined,
              providerMessageId:
                sendResult.providerMessageId ?? sendResult.smtpMessageId ?? undefined,
            },
          });
          await this.usage.recordEmailsSent(workspaceId, 1);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await this.prisma.messageEvent.update({
            where: { id: event.id },
            data: {
              status: MessageEventStatus.FAILED,
              error: message.slice(0, 2000),
            },
          });
        }

        processed++;
        await job.updateProgress({ processed, total });
      }

      cursor = batch[batch.length - 1]!.id;
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.SENT,
        sentAt: new Date(),
      },
    });

    this.logger.log(`Campaign ${campaignId} send completed (${total} recipients)`);
  }

  async markCampaignFailed(campaignId: string): Promise<void> {
    await this.prisma.campaign.updateMany({
      where: { id: campaignId, status: CampaignStatus.SENDING },
      data: { status: CampaignStatus.FAILED },
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClosed) {
      return;
    }
    this.redisClosed = true;
    await this.redis.quit().catch(() => {});
  }
}
