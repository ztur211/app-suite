import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable, of, concatMap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<{
      headers: Record<string, string | string[] | undefined>;
      body: unknown;
      method: string;
      route?: { path?: string };
      originalUrl?: string;
      session?: { user?: { id?: string } };
    }>();
    const keyHeader = req.headers['idempotency-key'];
    const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
    if (!key) {
      throw new BadRequestException('Idempotency-Key header required');
    }
    const userId = req.session?.user?.id;
    if (!userId) {
      throw new BadRequestException('SessionGuard must run before IdempotencyInterceptor');
    }

    const endpoint = `${req.method} ${req.route?.path ?? req.originalUrl ?? ''}`;
    const bodyHash = sha256(stableStringify(req.body ?? {}));

    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.userId !== userId || existing.endpoint !== endpoint) {
        throw new ConflictException('Idempotency-Key reused with different request');
      }
      if (existing.requestBodyHash !== bodyHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency-Key reused with different request body',
        });
      }
      const res = http.getResponse<{ status: (c: number) => unknown; statusCode: number }>();
      res.status(existing.statusCode);
      return of(JSON.parse(existing.responseBody));
    }

    return next.handle().pipe(
      concatMap(async (response: unknown) => {
        const res = http.getResponse<{ statusCode: number }>();
        try {
          await this.prisma.idempotencyKey.create({
            data: {
              key,
              userId,
              endpoint,
              requestBodyHash: bodyHash,
              statusCode: res.statusCode,
              responseBody: JSON.stringify(response ?? null),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
        } catch {
          // Concurrent race: another request with same key already won.
          // The next call with this key will replay the winning response.
        }
        return response;
      }),
    );
  }
}
