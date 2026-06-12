import { UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthApiLike } from '@things/auth';

export interface SessionData {
  user: { id: string; email: string; timezone: string };
  session: { id: string; userId: string; expiresAt: Date };
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: SessionData;
    userId?: string;
  }
}

/**
 * Base guard that validates a Better Auth session cookie against the app's own
 * `auth` instance. Subclass it per app so each keeps a NestJS-DI-able guard:
 *
 *   @Injectable()
 *   export class SessionGuard extends AbstractSessionGuard {
 *     protected readonly auth = auth;
 *   }
 */
export abstract class AbstractSessionGuard implements CanActivate {
  protected abstract readonly auth: AuthApiLike;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    });

    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new UnauthorizedException();

    req.session = session as unknown as SessionData;
    req.userId = session.user.id;
    return true;
  }
}
