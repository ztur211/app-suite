import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from '../session.guard';

jest.mock('../auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}));

import { auth } from '../auth';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const req = { headers, userId: undefined as string | undefined, session: undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard (unit)', () => {
  let guard: SessionGuard;

  beforeEach(() => {
    guard = new SessionGuard();
    jest.clearAllMocks();
  });

  it('returns true and sets req.userId when session is valid', async () => {
    (auth.api.getSession as unknown as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-1', email: 'a@b.com', timezone: 'UTC' },
      session: { id: 's', userId: 'user-1', expiresAt: new Date() },
    });
    const ctx = makeContext({ cookie: 'better-auth.session_token=abc' });
    expect(await guard.canActivate(ctx)).toBe(true);
    const req = ctx.switchToHttp().getRequest() as { userId: string };
    expect(req.userId).toBe('user-1');
  });

  it('throws when no session', async () => {
    (auth.api.getSession as unknown as jest.Mock).mockResolvedValueOnce(null);
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });
});
