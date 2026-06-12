import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { verifyServiceToken, type ServiceJwtPayload } from '@things/auth';

export interface ServiceJwtGuardOptions {
  /** Audience this service expects in incoming tokens, e.g. 'api-do'. */
  expectedAud: string;
  /** Caller `iss` values allowed to call this service, e.g. ['api-say']. */
  whitelist: string[];
}

/**
 * Guard that authenticates service-to-service calls via a short-lived HMAC JWT
 * (signed with SERVICE_TOKEN_SECRET). Instantiate per route group:
 *
 *   @UseGuards(new ServiceJwtGuard({ expectedAud: 'api-say', whitelist: ['api-buy', 'api-eat'] }))
 */
export class ServiceJwtGuard implements CanActivate {
  constructor(private readonly opts: ServiceJwtGuardOptions) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
      serviceCaller?: ServiceJwtPayload;
    }>();

    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }
    const token = header.slice('Bearer '.length);

    const secret = process.env['SERVICE_TOKEN_SECRET'];
    if (!secret) {
      throw new UnauthorizedException('SERVICE_TOKEN_SECRET not configured');
    }

    let payload: ServiceJwtPayload;
    try {
      payload = verifyServiceToken(token, { secret, expectedAud: this.opts.expectedAud });
    } catch (e) {
      throw new UnauthorizedException(`Invalid service token: ${(e as Error).message}`);
    }

    if (!this.opts.whitelist.includes(payload.iss)) {
      throw new ForbiddenException(`Caller ${payload.iss} not whitelisted`);
    }

    req.serviceCaller = payload;
    req.userId = payload.sub;
    return true;
  }
}
