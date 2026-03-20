import { WebhookBounceKind, WebhookMailEventType } from '@prisma/client';
import { normalizeMessageIdForStorage } from '../../../mail/message-id.util';
import type { NormalizedMailWebhookEvent } from '../mail-webhook.types';
import { isValidEmail } from './generic-mail-webhook.normalize';

/**
 * Normalize a single SendGrid Event Webhook payload object.
 * @see https://docs.sendgrid.com/for-developers/tracking-events/event
 */
export function normalizeSendGridMailEvent(ev: unknown): NormalizedMailWebhookEvent | null {
  if (ev === null || typeof ev !== 'object') {
    return null;
  }
  const o = ev as Record<string, unknown>;
  const email = String(o.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !isValidEmail(email)) {
    return null;
  }

  const event = String(o.event ?? '')
    .trim()
    .toLowerCase();

  let type: WebhookMailEventType;
  let bounceKind: WebhookBounceKind | undefined;

  switch (event) {
    case 'delivered':
      type = WebhookMailEventType.DELIVERED;
      break;
    case 'deferred':
      type = WebhookMailEventType.DEFERRED;
      break;
    case 'spamreport':
      type = WebhookMailEventType.COMPLAINED;
      break;
    case 'bounce':
    case 'dropped':
      type = WebhookMailEventType.BOUNCED;
      bounceKind = classifySendGridBounce(o, event);
      break;
    default:
      return null;
  }

  const sgMsg = o.sg_message_id != null ? String(o.sg_message_id).trim() : '';
  const smtpRaw = o['smtp-id'] != null ? String(o['smtp-id']).trim() : '';

  const providerMessageId = sgMsg || undefined;
  const smtpMessageId = normalizeMessageIdForStorage(smtpRaw) ?? normalizeMessageIdForStorage(sgMsg);

  const providerEventId =
    o.sg_event_id != null && String(o.sg_event_id).trim() !== ''
      ? String(o.sg_event_id).trim()
      : undefined;

  let receivedAt = new Date();
  if (o.timestamp != null) {
    const ts = Number(o.timestamp);
    if (Number.isFinite(ts)) {
      receivedAt = new Date(ts * 1000);
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

function classifySendGridBounce(
  o: Record<string, unknown>,
  event: string,
): WebhookBounceKind {
  if (event === 'dropped') {
    return WebhookBounceKind.HARD;
  }
  const reason = String(o.reason ?? '').toLowerCase();
  const type = String(o.type ?? '').toLowerCase();
  if (type === 'blocked' || type === 'expired') {
    return WebhookBounceKind.HARD;
  }
  if (/\b5\.\d+\.\d+\b/.test(reason) || reason.includes('invalid') || reason.includes('unknown user')) {
    return WebhookBounceKind.HARD;
  }
  if (/\b4\.\d+\.\d+\b/.test(reason) || type === 'bounce') {
    return WebhookBounceKind.SOFT;
  }
  return WebhookBounceKind.UNKNOWN;
}
