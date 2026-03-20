import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** URL-safe opaque segment (no dot) for composite tokens `userId.secret`. */
export function generateSecretSegment(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(plain: string, pepper: string): string {
  return createHash('sha256').update(pepper, 'utf8').update('\0').update(plain, 'utf8').digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyOpaqueTokenHash(plain: string, pepper: string, storedHex: string): boolean {
  const h = hashOpaqueToken(plain, pepper);
  return timingSafeEqualHex(h, storedHex);
}

/**
 * Composite format: `<userId>.<secret>` where userId is a cuid (no dots).
 */
export function parseCompositeToken(raw: string): { userId: string; secret: string } | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  const dot = t.indexOf('.');
  if (dot <= 0 || dot === t.length - 1) {
    return null;
  }
  const userId = t.slice(0, dot);
  const secret = t.slice(dot + 1);
  if (!userId || !secret) {
    return null;
  }
  return { userId, secret };
}

export function buildCompositeToken(userId: string, secret: string): string {
  return `${userId}.${secret}`;
}
