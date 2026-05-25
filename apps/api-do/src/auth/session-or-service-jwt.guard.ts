import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SessionGuard } from './session.guard';
import { ServiceJwtGuard } from './service-jwt.guard';

/**
 * Composite guard: accepts EITHER a Better Auth session cookie OR a service
 * JWT from a whitelisted caller. Used on cross-app write endpoints (e.g.
 * `POST /tasks`) so api-say can create tasks on behalf of a user without
 * holding a user session.
 */
@Injectable()
export class SessionOrServiceJwtGuard implements CanActivate {
  private readonly session = new SessionGuard();
  private readonly service = new ServiceJwtGuard(['api-say']);

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const auth = req.headers['authorization'];
    if (auth?.startsWith('Bearer ')) {
      return this.service.canActivate(ctx);
    }
    return this.session.canActivate(ctx);
  }
}
