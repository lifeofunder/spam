import { WebhookBounceKind, WebhookMailEventType } from '@prisma/client';
import {
  isValidEmail,
  normalizeGenericMailWebhook,
} from './generic-mail-webhook.normalize';

describe('normalizeGenericMailWebhook', () => {
  it('maps delivered', () => {
    const n = normalizeGenericMailWebhook({
      type: 'delivered',
      email: 'User@Example.com',
    });
    expect(n).toMatchObject({
      type: WebhookMailEventType.DELIVERED,
      email: 'user@example.com',
    });
  });

  it('maps bounce with hard kind', () => {
    const n = normalizeGenericMailWebhook({
      type: 'bounced',
      email: 'a@b.co',
      bounceKind: 'hard',
      providerEventId: 'evt-1',
    });
    expect(n).toMatchObject({
      type: WebhookMailEventType.BOUNCED,
      bounceKind: WebhookBounceKind.HARD,
      providerEventId: 'evt-1',
    });
  });

  it('returns null for bad email', () => {
    expect(normalizeGenericMailWebhook({ type: 'delivered', email: 'nope' })).toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(normalizeGenericMailWebhook({ type: 'open', email: 'a@b.co' })).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts simple address', () => {
    expect(isValidEmail('x@y.co')).toBe(true);
  });
});
