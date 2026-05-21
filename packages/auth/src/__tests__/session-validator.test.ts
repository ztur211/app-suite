import { validateSessionFromCookie } from '../session-validator';

const makeMockAuth = (
  sessionResult: { user: { id: string }; session: { id: string } } | null,
  shouldThrow = false,
) => ({
  api: {
    getSession: jest.fn(async () => {
      if (shouldThrow) throw new Error('DB connection failed');
      return sessionResult;
    }),
  },
});

describe('validateSessionFromCookie', () => {
  it('returns null when cookieHeader is undefined', async () => {
    const auth = makeMockAuth({ user: { id: 'u1' }, session: { id: 's1' } });
    const result = await validateSessionFromCookie(undefined, auth);
    expect(result).toBeNull();
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it('returns null when cookieHeader is an empty string', async () => {
    const auth = makeMockAuth({ user: { id: 'u1' }, session: { id: 's1' } });
    const result = await validateSessionFromCookie('', auth);
    expect(result).toBeNull();
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it('returns null when auth.api.getSession returns null', async () => {
    const auth = makeMockAuth(null);
    const result = await validateSessionFromCookie('session=abc', auth);
    expect(result).toBeNull();
  });

  it('returns { userId, sessionId } when session is valid', async () => {
    const auth = makeMockAuth({ user: { id: 'u_123' }, session: { id: 's_456' } });
    const result = await validateSessionFromCookie('better-auth.session_token=xyz', auth);
    expect(result).toEqual({ userId: 'u_123', sessionId: 's_456' });
  });

  it('passes the cookie header to getSession via a Headers object', async () => {
    const auth = makeMockAuth({ user: { id: 'u1' }, session: { id: 's1' } });
    const cookieHeader = 'better-auth.session_token=tok123';
    await validateSessionFromCookie(cookieHeader, auth);
    const call = auth.api.getSession.mock.calls[0] as [{ headers: Headers }];
    expect(call[0]).toBeDefined();
    const headers = call[0].headers as Headers;
    expect(headers.get('cookie')).toBe(cookieHeader);
  });

  it('propagates errors thrown by auth.api.getSession', async () => {
    const auth = makeMockAuth(null, /* shouldThrow */ true);
    await expect(validateSessionFromCookie('session=abc', auth)).rejects.toThrow(
      'DB connection failed',
    );
  });
});
