import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyServiceToken } from '@things/auth';

@Injectable()
export class ServiceJwtGuard implements CanActivate {
  constructor(private readonly whitelist: string[]) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      userId?: string;
      serviceCaller?: { iss: string; aud: string; sub: string };
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

    let payload;
    try {
      payload = verifyServiceToken(token, { secret, expectedAud: 'api-do' });
    } catch (e) {
      throw new UnauthorizedException(`Invalid service token: ${(e as Error).message}`);
    }

    if (!this.whitelist.includes(payload.iss)) {
      throw new ForbiddenException(`Caller ${payload.iss} not whitelisted for this operation`);
    }

    req.serviceCaller = payload;
    req.userId = payload.sub;
    return true;
  }
}
