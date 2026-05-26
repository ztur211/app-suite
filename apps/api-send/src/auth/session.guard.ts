import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { auth } from './auth';

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

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const headers = new Headers();
    Object.entries(req.headers).forEach(([k, v]) => {
      if (typeof v === 'string') headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(', '));
    });

    const session = await auth.api.getSession({ headers });
    if (!session) throw new UnauthorizedException();

    req.session = session as unknown as SessionData;
    req.userId = session.user.id;
    return true;
  }
}
