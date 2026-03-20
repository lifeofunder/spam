import { WebhookBounceKind, WebhookMailEventType } from '@prisma/client';
import type { NormalizedMailWebhookEvent } from '../mail-webhook.types';

const TYPE_MAP: Record<string, WebhookMailEventType> = {
  delivered: WebhookMailEventType.DELIVERED,
  bounced: WebhookMailEventType.BOUNCED,
  bounce: WebhookMailEventType.BOUNCED,
  complained: WebhookMailEventType.COMPLAINED,
  complaint: WebhookMailEventType.COMPLAINED,
  spam: WebhookMailEventType.COMPLAINED,
  deferred: WebhookMailEventType.DEFERRED,
};

const BOUNCE_MAP: Record<string, WebhookBounceKind> = {
  hard: WebhookBounceKind.HARD,
  soft: WebhookBounceKind.SOFT,
  unknown: WebhookBounceKind.UNKNOWN,
};

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Parse generic JSON webhook body (MVP contract).
 */
export function normalizeGenericMailWebhook(body: unknown): NormalizedMailWebhookEvent | null {
  if (body === null || typeof body !== 'object') {
    return null;
  }
  const o = body as Record<string, unknown>;
  const email = String(o.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !isValidEmail(email)) {
    return null;
  }

  const typeStr = String(o.type ?? '')
    .trim()
    .toLowerCase();
  const type = TYPE_MAP[typeStr];
  if (!type) {
    return null;
  }

  let bounceKind: WebhookBounceKind | undefined;
  if (type === WebhookMailEventType.BOUNCED) {
    const bk = String(o.bounceKind ?? o.bounce ?? '')
      .trim()
      .toLowerCase();
    bounceKind = BOUNCE_MAP[bk] ?? WebhookBounceKind.UNKNOWN;
  }

  const providerMessageId = pickString(o.providerMessageId ?? o.provider_message_id);
  const smtpMessageId = pickString(o.smtpMessageId ?? o.smtp_message_id ?? o.messageId ?? o.message_id);
  const providerEventId = pickString(o.providerEventId ?? o.provider_event_id ?? o.eventId ?? o.event_id);

  let receivedAt = new Date();
  if (o.occurredAt != null || o.occurred_at != null) {
    const raw = o.occurredAt ?? o.occurred_at;
    const d = typeof raw === 'string' || typeof raw === 'number' ? new Date(raw) : new Date(String(raw));
    if (!Number.isNaN(d.getTime())) {
      receivedAt = d;
    }
  }

  return {
    type,
    email,
    providerMessageId,
    smtpMessageId,
    bounceKind,
    providerEventId,
    receivedAt,
  };
}

function pickString(v: unknown): string | undefined {
  if (v == null) {
    return undefined;
  }
  const s = String(v).trim();
  return s || undefined;
}
