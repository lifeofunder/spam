import { createHmac, timingSafeEqual } from 'crypto';

export interface UnsubscribeTokenPayload {
  c: string;
  w: string;
  exp?: number;
}

export function signUnsubscribeToken(
  contactId: string,
  workspaceId: string,
  secret: string,
  ttlDays?: number,
): string {
  const payload: UnsubscribeTokenPayload = { c: contactId, w: workspaceId };
  if (ttlDays !== undefined && ttlDays > 0) {
    payload.exp = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
  }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): UnsubscribeTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [data, sig] = parts;
  if (!data || !sig) {
    return null;
  }
  const expected = createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const json = Buffer.from(data, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as UnsubscribeTokenPayload;
    if (!payload.c || !payload.w) {
      return null;
    }
    if (payload.exp !== undefined && payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
