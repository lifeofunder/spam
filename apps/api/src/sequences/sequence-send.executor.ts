import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContactStatus,
  MessageEventStatus,
  SequenceEnrollmentStatus,
  SequenceStatus,
} from '@prisma/client';
import type { Job } from 'bullmq';
import type { MailProvider } from '../mail/mail-provider.interface';
import { MAIL_PROVIDER, type SendMailResult } from '../mail/mail.types';
import { buildEmailWithCompliance, type ContactWithId } from '../mail/compliance-email.util';
import { EntitlementsService } from '../billing/entitlements.service';
import { UsageService } from '../billing/usage.service';
import { PrismaService } from '../prisma.service';
import { createRateLimitRedis } from '../campaign-send/bullmq-redis';
import { SEQUENCE_ADVANCE_JOB_NAME, SEQUENCE_STEP_SEND_JOB_NAME } from './sequence-dispatch.constants';
import type { SequenceAdvancePayload, SequenceStepSendPayload } from './sequence-dispatch.types';
import { SequenceJobSchedulerService } from './sequence-job-scheduler.service';
import { getNextStepAfter, sortStepsByOrder } from './sequence-step-plan.util';

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
export class SequenceSendExecutor implements OnModuleDestroy {
  private readonly logger = new Logger(SequenceSendExecutor.name);
  private readonly redis = createRateLimitRedis();
  private redisClosed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SequenceJobSchedulerService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageService,
  ) {}

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

  /** Shared rate bucket with campaign sends (same env). */
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
        this.logger.warn(`Sequence transient mail error to ${to}, retry ${attempt + 1}/${retries}`);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  async processJob(job: Job<SequenceStepSendPayload | SequenceAdvancePayload>): Promise<void> {
    if (job.name === SEQUENCE_ADVANCE_JOB_NAME) {
      await this.processAdvance(job as Job<SequenceAdvancePayload>);
      return;
    }
    if (job.name === SEQUENCE_STEP_SEND_JOB_NAME) {
      await this.processStepSend(job as Job<SequenceStepSendPayload>);
      return;
    }
    this.logger.warn(`Unknown sequence job name: ${job.name}`);
  }

  private async processAdvance(job: Job<SequenceAdvancePayload>): Promise<void> {
    const { enrollmentId, workspaceId, nextStepOrder } = job.data;

    const enrollment = await this.prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, workspaceId },
      include: { sequence: true },
    });

    if (!enrollment) {
      this.logger.warn(`sequence-advance: enrollment ${enrollmentId} missing`);
      return;
    }

    if (
      enrollment.status !== SequenceEnrollmentStatus.ACTIVE ||
      enrollment.sequence.status !== SequenceStatus.ACTIVE
    ) {
      this.logger.warn(
        `sequence-advance noop enrollment=${enrollmentId} enr=${enrollment.status} seq=${enrollment.sequence.status}`,
      );
      return;
    }

    if (enrollment.currentStepOrder !== nextStepOrder) {
      this.logger.warn(
        `sequence-advance skip enrollment=${enrollmentId} expected step ${nextStepOrder} but current=${enrollment.currentStepOrder}`,
      );
      return;
    }

    const jobId = await this.scheduler.scheduleStepSend(
      { enrollmentId, workspaceId, stepOrder: nextStepOrder },
      0,
    );

    await this.prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { pendingJobId: jobId, nextRunAt: null },
    });
  }

  private async processStepSend(job: Job<SequenceStepSendPayload>): Promise<void> {
    const { enrollmentId, workspaceId, stepOrder } = job.data;

    const enrollment = await this.prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, workspaceId },
      include: {
        sequence: { include: { steps: { include: { template: true } } } },
        contact: true,
      },
    });

    if (!enrollment) {
      this.logger.warn(`sequence-step-send: enrollment ${enrollmentId} missing`);
      return;
    }

    if (enrollment.sequence.status !== SequenceStatus.ACTIVE) {
      await this.softCancel(enrollmentId, 'sequence not active');
      return;
    }

    if (enrollment.status !== SequenceEnrollmentStatus.ACTIVE) {
      this.logger.warn(`sequence-step-send noop enrollment ${enrollmentId} status=${enrollment.status}`);
      return;
    }

    if (enrollment.contact.status !== ContactStatus.SUBSCRIBED) {
      await this.softCancel(enrollmentId, `contact ${enrollment.contact.status}`);
      return;
    }

    if (enrollment.currentStepOrder !== stepOrder) {
      this.logger.warn(
        `sequence-step-send skip enrollment=${enrollmentId} job step ${stepOrder} current=${enrollment.currentStepOrder}`,
      );
      return;
    }

    const steps = sortStepsByOrder(enrollment.sequence.steps);
    const step = steps.find((s) => s.order === stepOrder);
    if (!step) {
      await this.softCancel(enrollmentId, 'step removed');
      return;
    }

    const alreadySent = await this.prisma.messageEvent.findFirst({
      where: {
        sequenceEnrollmentId: enrollmentId,
        sequenceStepOrder: stepOrder,
        status: MessageEventStatus.SENT,
      },
    });
    if (alreadySent) {
      this.logger.warn(
        `sequence-step-send: step ${stepOrder} already SENT for enrollment ${enrollmentId}, idempotent skip`,
      );
      return;
    }

    const contact = enrollment.contact;
    const contactVars: ContactWithId = {
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      phone: contact.phone,
      tags: contact.tags,
    };

    const tpl = step.template;

    try {
      await this.entitlements.assertCanSendEmail(workspaceId);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === HttpStatus.PAYMENT_REQUIRED) {
        await this.softCancel(enrollmentId, 'billing limit or subscription past due');
        return;
      }
      throw e;
    }

    const msg = await this.prisma.messageEvent.create({
      data: {
        workspaceId,
        campaignId: null,
        contactId: contact.id,
        email: contact.email,
        status: MessageEventStatus.QUEUED,
        sequenceId: enrollment.sequenceId,
        sequenceEnrollmentId: enrollmentId,
        sequenceStepOrder: stepOrder,
      },
    });

    await this.acquireWorkspaceSendSlot(workspaceId);

    try {
      const { subject, html, text } = buildEmailWithCompliance(
        tpl.subject,
        tpl.html,
        tpl.text,
        contactVars,
        workspaceId,
        this.complianceOpts(),
      );

      const sendResult = await this.sendWithRetries(contact.email, subject, html, text);

      await this.prisma.messageEvent.update({
        where: { id: msg.id },
        data: {
          status: MessageEventStatus.SENT,
          smtpMessageId: sendResult.smtpMessageId ?? undefined,
          providerMessageId: sendResult.providerMessageId ?? sendResult.smtpMessageId ?? undefined,
        },
      });

      await this.usage.recordEmailsSent(workspaceId, 1);

      await this.afterStepSentSuccess(enrollmentId, workspaceId, stepOrder, steps);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.messageEvent.update({
        where: { id: msg.id },
        data: {
          status: MessageEventStatus.FAILED,
          error: message.slice(0, 2000),
        },
      });
      await this.softCancel(enrollmentId, `send failed: ${message.slice(0, 200)}`);
      throw err;
    }
  }

  private async afterStepSentSuccess(
    enrollmentId: string,
    workspaceId: string,
    completedOrder: number,
    steps: { order: number; delayMinutes: number }[],
  ): Promise<void> {
    const next = getNextStepAfter(steps, completedOrder);

    if (!next) {
      await this.scheduler.removeAllKnownJobsForEnrollment(enrollmentId);
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: SequenceEnrollmentStatus.COMPLETED,
          pendingJobId: null,
          nextRunAt: null,
          currentStepOrder: completedOrder,
        },
      });
      return;
    }

    await this.prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStepOrder: next.order,
        nextRunAt: new Date(Date.now() + next.delayMinutes * 60_000),
      },
    });

    const delayMs = next.delayMinutes * 60_000;
    const advanceId = await this.scheduler.scheduleAdvance(
      { enrollmentId, workspaceId, nextStepOrder: next.order },
      delayMs,
    );

    await this.prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { pendingJobId: advanceId },
    });
  }

  private async softCancel(enrollmentId: string, reason: string): Promise<void> {
    this.logger.warn(`Enrollment ${enrollmentId} cancelled: ${reason}`);
    await this.scheduler.removeAllKnownJobsForEnrollment(enrollmentId);
    await this.prisma.sequenceEnrollment.updateMany({
      where: { id: enrollmentId, status: SequenceEnrollmentStatus.ACTIVE },
      data: {
        status: SequenceEnrollmentStatus.CANCELLED,
        pendingJobId: null,
        nextRunAt: null,
      },
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
