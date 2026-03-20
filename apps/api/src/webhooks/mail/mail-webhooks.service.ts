import { Injectable, Logger } from '@nestjs/common';
import {
  ContactStatus,
  Prisma,
  type MessageEvent,
  WebhookBounceKind,
  WebhookMailEventType,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SequenceLifecycleService } from '../../sequences/sequence-lifecycle.service';
import { normalizeMessageIdForStorage } from '../../mail/message-id.util';
import { computeMailWebhookIdempotencyKey } from './mail-webhook-idempotency.util';
import type { NormalizedMailWebhookEvent } from './mail-webhook.types';

function isPrismaUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

@Injectable()
export class MailWebhooksService {
  private readonly logger = new Logger(MailWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceLifecycle: SequenceLifecycleService,
  ) {}

  /**
   * Persist webhook (idempotent) and apply suppression rules.
   */
  async ingest(
    provider: string,
    normalized: NormalizedMailWebhookEvent,
    rawPayload: unknown,
  ): Promise<{ ok: boolean; duplicate?: boolean }> {
    const idempotencyKey = computeMailWebhookIdempotencyKey(
      provider,
      normalized.providerEventId,
      rawPayload,
    );

    const messageEvent = await this.findMessageEventForWebhook(normalized);

    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider,
          idempotencyKey,
          providerEventId: normalized.providerEventId ?? null,
          type: normalized.type,
          bounceKind: normalized.bounceKind ?? null,
          email: normalized.email,
          workspaceId: messageEvent?.workspaceId ?? null,
          contactId: messageEvent?.contactId ?? null,
          messageEventId: messageEvent?.id ?? null,
          rawPayload: rawPayload as Prisma.InputJsonValue,
          receivedAt: normalized.receivedAt,
        },
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    await this.applySuppression(normalized, messageEvent);

    return { ok: true };
  }

  private async findMessageEventForWebhook(
    n: NormalizedMailWebhookEvent,
  ): Promise<MessageEvent | null> {
    const or: Prisma.MessageEventWhereInput[] = [];
    const pid = n.providerMessageId?.trim();
    const sid = normalizeMessageIdForStorage(n.smtpMessageId);

    if (pid) {
      const np = normalizeMessageIdForStorage(pid) ?? pid.toLowerCase();
      or.push({ providerMessageId: pid });
      if (np !== pid) {
        or.push({ providerMessageId: np });
      }
      or.push({ smtpMessageId: np });
    }
    if (sid) {
      or.push({ smtpMessageId: sid });
      or.push({ providerMessageId: sid });
    }

    if (!or.length) {
      return null;
    }

    return this.prisma.messageEvent.findFirst({
      where: { OR: or },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async applySuppression(
    normalized: NormalizedMailWebhookEvent,
    messageEvent: MessageEvent | null,
  ): Promise<void> {
    const suppress =
      normalized.type === WebhookMailEventType.COMPLAINED ||
      (normalized.type === WebhookMailEventType.BOUNCED &&
        normalized.bounceKind === WebhookBounceKind.HARD);

    if (!suppress) {
      if (
        normalized.type === WebhookMailEventType.BOUNCED &&
        normalized.bounceKind === WebhookBounceKind.SOFT
      ) {
        this.logger.debug(`Soft bounce recorded for ${normalized.email} (no contact status change)`);
      }
      return;
    }

    if (messageEvent?.contactId) {
      await this.prisma.contact.update({
        where: { id: messageEvent.contactId },
        data: { status: ContactStatus.BOUNCED },
      });
      await this.sequenceLifecycle.cancelEnrollmentsForContact(messageEvent.contactId);
      return;
    }

    const contacts = await this.prisma.contact.findMany({
      where: { email: normalized.email },
      select: { id: true },
    });
    const r = await this.prisma.contact.updateMany({
      where: { email: normalized.email },
      data: { status: ContactStatus.BOUNCED },
    });
    for (const c of contacts) {
      await this.sequenceLifecycle.cancelEnrollmentsForContact(c.id);
    }
    if (r.count === 0) {
      this.logger.warn(
        `Suppression event for ${normalized.email} but no MessageEvent match and no Contact row`,
      );
    }
  }
}
