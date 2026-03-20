/**
 * Normalize Message-ID for storage and webhook correlation (angle brackets removed, lowercased).
 */
export function normalizeMessageIdForStorage(raw?: string | null): string | undefined {
  if (raw == null || typeof raw !== 'string') {
    return undefined;
  }
  const t = raw.trim();
  if (!t) {
    return undefined;
  }
  return t.replace(/^<|>$/g, '').trim().toLowerCase();
}
