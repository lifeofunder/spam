import { createHash } from 'crypto';

/**
 * Stable idempotency key: provider + explicit event id, or provider + sha256(JSON payload).
 */
export function computeMailWebhookIdempotencyKey(
  provider: string,
  providerEventId: string | undefined,
  rawPayload: unknown,
): string {
  const p = provider.trim() || 'unknown';
  if (providerEventId?.trim()) {
    return `${p}:${providerEventId.trim()}`;
  }
  const json = safeStableStringify(rawPayload);
  const hash = createHash('sha256').update(json, 'utf8').digest('hex');
  return `${p}:sha256:${hash}`;
}

function safeStableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}
