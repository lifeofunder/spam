import {
  buildCompositeToken,
  hashOpaqueToken,
  parseCompositeToken,
  verifyOpaqueTokenHash,
} from './token-crypto.util';

describe('token-crypto.util', () => {
  const pepper = 'test-pepper';

  it('hash + verify round-trip', () => {
    const secret = 'abc123';
    const h = hashOpaqueToken(secret, pepper);
    expect(h.length).toBe(64);
    expect(verifyOpaqueTokenHash(secret, pepper, h)).toBe(true);
    expect(verifyOpaqueTokenHash('wrong', pepper, h)).toBe(false);
  });

  it('parseCompositeToken parses cuid.secret', () => {
    const uid = 'clxxxxxxxxxxxxxxxxxxxxxxxxx';
    const raw = buildCompositeToken(uid, 'seg');
    expect(parseCompositeToken(raw)).toEqual({ userId: uid, secret: 'seg' });
    expect(parseCompositeToken('nope')).toBeNull();
    expect(parseCompositeToken('.x')).toBeNull();
    expect(parseCompositeToken('')).toBeNull();
  });
});
