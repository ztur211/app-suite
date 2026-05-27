import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from '../idempotency.interceptor';
import { PrismaService } from '../../prisma/prisma.service';

describe('IdempotencyInterceptor (integration)', () => {
  let prisma: PrismaService;
  let interceptor: IdempotencyInterceptor;
  const userId = 'u-idem';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `idem-${Date.now()}@things-test.local`,
        emailVerified: true,
        timezone: 'UTC',
      },
      update: {},
    });
    interceptor = new IdempotencyInterceptor(prisma);
  });

  beforeEach(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  function makeCtx(
    headers: Record<string, string>,
    body: unknown,
    uid: string = userId,
  ): ExecutionContext {
    let statusCode = 200;
    const req = {
      headers,
      body,
      method: 'POST',
      route: { path: '/dictations' },
      session: { user: { id: uid } },
    };
    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(c: number) {
        statusCode = c;
      },
      status(c: number) {
        statusCode = c;
        return this;
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  }

  function nextWith(value: unknown): CallHandler {
    return { handle: () => of(value) } as CallHandler;
  }

  it('throws BadRequest when Idempotency-Key header missing', async () => {
    const ctx = makeCtx({}, { a: 1 });
    await expect(interceptor.intercept(ctx, nextWith({}))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('executes handler on first request and caches the response', async () => {
    const ctx = makeCtx({ 'idempotency-key': 'k1' }, { a: 1 });
    const stream = await interceptor.intercept(ctx, nextWith({ ok: true, v: 7 }));
    const out = await lastValueFrom(stream);
    expect(out).toEqual({ ok: true, v: 7 });

    // Give the tap() a tick to flush
    const row = await prisma.idempotencyKey.findUnique({ where: { key: 'k1' } });
    expect(row).not.toBeNull();
    expect(JSON.parse(row?.responseBody ?? 'null')).toEqual({ ok: true, v: 7 });
  });

  it('replays cached response on same key + same body without re-running the handler', async () => {
    const ctx1 = makeCtx({ 'idempotency-key': 'k2' }, { a: 1 });
    await lastValueFrom(await interceptor.intercept(ctx1, nextWith({ id: 'd1' })));

    const ctx2 = makeCtx({ 'idempotency-key': 'k2' }, { a: 1 });
    const handle = jest.fn(() => of({ id: 'NEVER' }));
    const out = await lastValueFrom(
      await interceptor.intercept(ctx2, { handle } as unknown as CallHandler),
    );
    expect(out).toEqual({ id: 'd1' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('returns 409 on same key + different body', async () => {
    const ctx1 = makeCtx({ 'idempotency-key': 'k3' }, { a: 1 });
    await lastValueFrom(await interceptor.intercept(ctx1, nextWith({ id: 'd1' })));

    const ctx2 = makeCtx({ 'idempotency-key': 'k3' }, { a: 2 });
    await expect(interceptor.intercept(ctx2, nextWith({}))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns 409 on same key + different user', async () => {
    const ctx1 = makeCtx({ 'idempotency-key': 'k4' }, { a: 1 });
    await lastValueFrom(await interceptor.intercept(ctx1, nextWith({ id: 'd1' })));

    const otherUserId = 'u-idem-other';
    await prisma.user.upsert({
      where: { id: otherUserId },
      create: {
        id: otherUserId,
        email: `idem-other-${Date.now()}@things-test.local`,
        emailVerified: true,
        timezone: 'UTC',
      },
      update: {},
    });
    try {
      const ctx2 = makeCtx({ 'idempotency-key': 'k4' }, { a: 1 }, otherUserId);
      await expect(interceptor.intercept(ctx2, nextWith({}))).rejects.toBeInstanceOf(
        ConflictException,
      );
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
    }
  });
});
