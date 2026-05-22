import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { auth } from './auth';

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

    (req as Request & { userId: string }).userId = session.user.id;
    return true;
  }
}
