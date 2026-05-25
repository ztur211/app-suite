import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { signServiceToken } from '@things/auth';
import { ServiceJwtGuard } from '../service-jwt.guard';

const SECRET = 'dev-things-auth-secret-min-32-chars-long-abc';

beforeAll(() => {
  process.env.SERVICE_TOKEN_SECRET = SECRET;
});

function ctx(headers: Record<string, string>): ExecutionContext {
  const req = { headers } as { headers: Record<string, string>; userId?: string };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ServiceJwtGuard (api-say inbound)', () => {
  const guard = new ServiceJwtGuard(['api-buy', 'api-eat']);

  it('accepts api-buy', async () => {
    const tok = signServiceToken({ iss: 'api-buy', aud: 'api-say', sub: 'u1' }, { secret: SECRET });
    await expect(guard.canActivate(ctx({ authorization: `Bearer ${tok}` }))).resolves.toBe(true);
  });

  it('accepts api-eat', async () => {
    const tok = signServiceToken({ iss: 'api-eat', aud: 'api-say', sub: 'u1' }, { secret: SECRET });
    await expect(guard.canActivate(ctx({ authorization: `Bearer ${tok}` }))).resolves.toBe(true);
  });

  it('rejects api-do (not whitelisted)', async () => {
    const tok = signServiceToken({ iss: 'api-do', aud: 'api-say', sub: 'u1' }, { secret: SECRET });
    await expect(guard.canActivate(ctx({ authorization: `Bearer ${tok}` }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects missing Authorization header', async () => {
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
