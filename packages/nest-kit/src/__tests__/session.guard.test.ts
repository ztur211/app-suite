import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthApiLike } from '@things/auth';
import { AbstractSessionGuard } from '../session.guard';

function makeContext(headers: Record<string, string | string[]> = {}): ExecutionContext {
  const req = { headers, userId: undefined, session: undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

// Concrete subclass for the test, injecting a mock `auth` (the per-app subclass
// does the same with its real betterAuth instance).
const getSession = jest.fn();
class TestSessionGuard extends AbstractSessionGuard {
  protected readonly auth: AuthApiLike = { api: { getSession } } as unknown as AuthApiLike;
}

describe('AbstractSessionGuard', () => {
  const guard = new TestSessionGuard();
  beforeEach(() => getSession.mockReset());

  it('throws UnauthorizedException when there is no valid session', async () => {
    getSession.mockResolvedValueOnce(null);
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches session + userId and returns true on a valid cookie', async () => {
    getSession.mockResolvedValueOnce({
      user: { id: 'u1', email: 'x@example.com', timezone: 'Pacific/Auckland' },
      session: { id: 's1', userId: 'u1', expiresAt: new Date() },
    });
    const ctx = makeContext({ cookie: 'better-auth.session_token=fake' });
    const req = ctx.switchToHttp().getRequest<{
      session?: { user: { id: string; timezone: string } };
      userId?: string;
    }>();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.userId).toBe('u1');
    expect(req.session?.user.id).toBe('u1');
    expect(req.session?.user.timezone).toBe('Pacific/Auckland');
  });

  it('forwards request headers (string and array) to getSession as a Headers object', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'u2' }, session: { id: 's2' } });
    await guard.canActivate(makeContext({ cookie: 'c=1', 'x-multi': ['a', 'b'] }));
    const passed = getSession.mock.calls[0][0].headers as Headers;
    expect(passed.get('cookie')).toBe('c=1');
    expect(passed.get('x-multi')).toBe('a, b');
  });
});
