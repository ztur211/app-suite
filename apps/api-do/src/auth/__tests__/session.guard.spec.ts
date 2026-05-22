import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from '../session.guard';

// Mock the auth module so no real DB is touched
jest.mock('../auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { auth } from '../auth';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const req = {
    headers,
    userId: undefined as string | undefined,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
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
      user: { id: 'user-123' },
      session: { id: 'sess-abc' },
    });

    const ctx = makeContext({ cookie: 'better-auth.session_token=abc' });
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest() as { userId: string };
    expect(req.userId).toBe('user-123');
  });

  it('throws UnauthorizedException when session is null', async () => {
    (auth.api.getSession as unknown as jest.Mock).mockResolvedValueOnce(null);

    const ctx = makeContext({ cookie: 'better-auth.session_token=invalid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when no cookie header', async () => {
    (auth.api.getSession as unknown as jest.Mock).mockResolvedValueOnce(null);

    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
