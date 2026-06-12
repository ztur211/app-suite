import { Injectable } from '@nestjs/common';
import { AbstractSessionGuard } from '@things/nest-kit';
import { auth } from './auth';

/** Validates a Better Auth session cookie against api-eat's `auth` instance. */
@Injectable()
export class SessionGuard extends AbstractSessionGuard {
  protected readonly auth = auth;
}
