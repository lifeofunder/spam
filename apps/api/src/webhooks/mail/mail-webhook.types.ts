import type { WebhookBounceKind, WebhookMailEventType } from '@prisma/client';

/** Normalized inbound mail event after provider-specific parsing. */
export interface NormalizedMailWebhookEvent {
  type: WebhookMailEventType;
  email: string;
  providerMessageId?: string;
  smtpMessageId?: string;
  bounceKind?: WebhookBounceKind;
  providerEventId?: string;
  receivedAt: Date;
}
