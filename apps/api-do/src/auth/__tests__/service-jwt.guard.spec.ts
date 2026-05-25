import { ExecutionContext } from '@nestjs/common';
import { signServiceToken } from '@things/auth';
import { ServiceJwtGuard } from '../service-jwt.guard';

const SECRET = 'dev-things-auth-secret-min-32-chars-long-abc';

beforeAll(() => {
  process.env.SERVICE_TOKEN_SECRET = SECRET;
});

function mockCtx(headers: Record<string, string>): ExecutionContext {
  const req = { headers } as { headers: Record<string, string> };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ServiceJwtGuard', () => {
  const guard = new ServiceJwtGuard(['api-say']);

  it('accepts valid JWT from whitelisted caller', async () => {
    const token = signServiceToken(
      { iss: 'api-say', aud: 'api-do', sub: 'u1' },
      { secret: SECRET },
    );
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects JWT from non-whitelisted caller', async () => {
    const token = signServiceToken(
      { iss: 'api-buy', aud: 'api-do', sub: 'u1' },
      { secret: SECRET },
    );
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/not whitelisted/i);
  });

  it('rejects missing Authorization header', async () => {
    await expect(guard.canActivate(mockCtx({}))).rejects.toThrow();
  });

  it('rejects malformed Authorization header', async () => {
    await expect(guard.canActivate(mockCtx({ authorization: 'foo' }))).rejects.toThrow();
  });

  it('attaches userId from JWT sub to the request', async () => {
    const token = signServiceToken(
      { iss: 'api-say', aud: 'api-do', sub: 'u_42' },
      { secret: SECRET },
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as {
      headers: Record<string, string>;
      userId?: string;
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    await guard.canActivate(ctx);
    expect(req.userId).toBe('u_42');
  });
});
