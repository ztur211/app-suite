import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { signServiceToken } from '@things/auth';
import { ServiceJwtGuard } from '../service-jwt.guard';

const SECRET = 'dev-things-auth-secret-min-32-chars-long-abc';

function mockCtx(headers: Record<string, string>): ExecutionContext {
  const req = { headers } as {
    headers: Record<string, string>;
    userId?: string;
    serviceCaller?: { iss: string; aud: string; sub: string };
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ServiceJwtGuard', () => {
  const guard = new ServiceJwtGuard({ expectedAud: 'api-do', whitelist: ['api-say'] });
  const orig = process.env['SERVICE_TOKEN_SECRET'];
  beforeAll(() => {
    process.env['SERVICE_TOKEN_SECRET'] = SECRET;
  });
  afterAll(() => {
    if (orig === undefined) delete process.env['SERVICE_TOKEN_SECRET'];
    else process.env['SERVICE_TOKEN_SECRET'] = orig;
  });

  it('accepts a valid JWT from a whitelisted caller and attaches serviceCaller + userId', async () => {
    const token = signServiceToken(
      { iss: 'api-say', aud: 'api-do', sub: 'u1' },
      { secret: SECRET },
    );
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    const req = ctx
      .switchToHttp()
      .getRequest<{ userId?: string; serviceCaller?: { iss: string } }>();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.userId).toBe('u1');
    expect(req.serviceCaller?.iss).toBe('api-say');
  });

  it('rejects (403) a JWT from a non-whitelisted caller', async () => {
    const token = signServiceToken(
      { iss: 'api-buy', aud: 'api-do', sub: 'u1' },
      { secret: SECRET },
    );
    await expect(
      guard.canActivate(mockCtx({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects (401) a token addressed to a different audience', async () => {
    const token = signServiceToken(
      { iss: 'api-say', aud: 'api-buy', sub: 'u1' },
      { secret: SECRET },
    );
    await expect(
      guard.canActivate(mockCtx({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects (401) a missing Authorization header', async () => {
    await expect(guard.canActivate(mockCtx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects (401) a malformed Authorization header', async () => {
    await expect(guard.canActivate(mockCtx({ authorization: 'foo' }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects (401) a token signed with the wrong secret', async () => {
    const token = signServiceToken(
      { iss: 'api-say', aud: 'api-do', sub: 'u1' },
      { secret: 'a-totally-different-secret-32-chars-xx' },
    );
    await expect(
      guard.canActivate(mockCtx({ authorization: `Bearer ${token}` })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
