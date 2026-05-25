import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

// Mock the entire auth module so better-auth (ESM) is never loaded.
jest.mock('../auth', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { SessionGuard } from '../session.guard';
import { auth } from '../auth';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  const req = {
    headers,
    userId: undefined as string | undefined,
    session: undefined as
      | { user: { id: string; email: string; timezone: string }; session: unknown }
      | undefined,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard (unit)', () => {
  const guard = new SessionGuard();
  const getSession = auth.api.getSession as unknown as jest.Mock;

  beforeEach(() => {
    getSession.mockReset();
  });

  it('rejects request without a valid session', async () => {
    getSession.mockResolvedValueOnce(null);
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches session and userId on a valid cookie', async () => {
    getSession.mockResolvedValueOnce({
      user: { id: 'u1', email: 'x@example.com', timezone: 'Pacific/Auckland' },
      session: { id: 's1', userId: 'u1', expiresAt: new Date() },
    });
    const ctx = makeContext({ cookie: 'better-auth.session_token=fake-token-bytes' });
    const req = ctx.switchToHttp().getRequest<{
      session?: { user: { id: string; timezone: string } };
      userId?: string;
    }>();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.session?.user.id).toBe('u1');
    expect(req.session?.user.timezone).toBe('Pacific/Auckland');
    expect(req.userId).toBe('u1');
  });
});
