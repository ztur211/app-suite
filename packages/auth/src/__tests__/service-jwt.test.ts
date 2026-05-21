import { signServiceToken, verifyServiceToken } from '../service-jwt';

const SECRET = 'test-secret-at-least-32-chars-long-abcdefg';
const ALT_SECRET = 'other-secret-at-least-32-chars-long-hijklmn';

const basePayload = {
  iss: 'api-say',
  aud: 'api-do',
  sub: 'user_abc123',
};

describe('signServiceToken / verifyServiceToken', () => {
  it('round-trips a valid payload', () => {
    const token = signServiceToken(basePayload, { secret: SECRET });
    const result = verifyServiceToken(token, {
      secret: SECRET,
      expectedAud: 'api-do',
    });
    expect(result.iss).toBe('api-say');
    expect(result.aud).toBe('api-do');
    expect(result.sub).toBe('user_abc123');
  });

  it('includes iat and exp in the signed token', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signServiceToken(basePayload, { secret: SECRET });
    const result = verifyServiceToken(token, {
      secret: SECRET,
      expectedAud: 'api-do',
    });
    const after = Math.floor(Date.now() / 1000);
    expect(result).toHaveProperty('iat');
    expect(result).toHaveProperty('exp');
    const payload = result as typeof result & { iat: number; exp: number };
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
    expect(payload.exp).toBe(payload.iat + 300);
  });

  it('respects custom expiresInSeconds', () => {
    const token = signServiceToken(basePayload, {
      secret: SECRET,
      expiresInSeconds: 60,
    });
    const result = verifyServiceToken(token, {
      secret: SECRET,
      expectedAud: 'api-do',
    }) as typeof basePayload & { iat: number; exp: number };
    expect(result.exp - result.iat).toBe(60);
  });

  it('throws when audience does not match expectedAud', () => {
    const token = signServiceToken(basePayload, { secret: SECRET });
    expect(() =>
      verifyServiceToken(token, {
        secret: SECRET,
        expectedAud: 'api-buy',
      }),
    ).toThrow(/audience/i);
  });

  it('throws on expired token', () => {
    const token = signServiceToken(basePayload, {
      secret: SECRET,
      expiresInSeconds: -1,
    });
    expect(() => verifyServiceToken(token, { secret: SECRET, expectedAud: 'api-do' })).toThrow();
  });

  it('throws when token is tampered', () => {
    const token = signServiceToken(basePayload, { secret: SECRET });
    const parts = token.split('.');
    // Flip one char in the signature
    const tampered =
      parts[0] +
      '.' +
      parts[1] +
      '.' +
      (parts[2] ? parts[2].slice(0, -1) + (parts[2].endsWith('a') ? 'b' : 'a') : 'x');
    expect(() => verifyServiceToken(tampered, { secret: SECRET, expectedAud: 'api-do' })).toThrow();
  });

  it('throws when wrong secret is used to verify', () => {
    const token = signServiceToken(basePayload, { secret: SECRET });
    expect(() =>
      verifyServiceToken(token, { secret: ALT_SECRET, expectedAud: 'api-do' }),
    ).toThrow();
  });

  it('works with sub set to "system"', () => {
    const token = signServiceToken(
      { iss: 'api-say', aud: 'api-do', sub: 'system' },
      { secret: SECRET },
    );
    const result = verifyServiceToken(token, { secret: SECRET, expectedAud: 'api-do' });
    expect(result.sub).toBe('system');
  });
});
