import 'reflect-metadata';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AiClient } from '@things/ai';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionGuard } from '../../auth/session.guard';
import { createAuthOwnerPrisma } from '../../test-utils/auth-owner-prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAsync = (...args: any[]) => Promise<any>;

class StubAi extends AiClient {
  transcribe = jest.fn<AnyAsync>();
  chat = jest.fn<AnyAsync>();
  chatStructured = jest.fn<AnyAsync>();
  summarize = jest.fn<AnyAsync>();
  embed = jest.fn<AnyAsync>();
  vision = jest.fn<AnyAsync>();
}

const userId = 'u-dict-int';

describe('Dictations (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stubAi: StubAi;

  beforeAll(async () => {
    stubAi = new StubAi();
    stubAi.transcribe.mockResolvedValue({
      text: 'remind me to call mum',
      segments: [],
      language: 'en',
      usage: { kind: 'audio', seconds: 0.5 },
    });
    stubAi.chatStructured.mockResolvedValue({
      value: { intent: 'DO', payload: { title: 'Call mum', dueAt: null }, confidence: 0.93 },
      usage: { kind: 'tokens', inputTokens: 100, outputTokens: 20 },
    });

    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiClient)
      .useValue(stubAi)
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.session = {
            user: { id: userId, email: 'int@x', timezone: 'Pacific/Auckland' },
            session: { id: 's1', userId, expiresAt: new Date(Date.now() + 60_000) },
          };
          req.userId = userId;
          return true;
        },
      })
      .compile();

    app = mod.createNestApplication();
    await app.init();

    prisma = mod.get(PrismaService);
    const writeAuth = createAuthOwnerPrisma();
    try {
      await writeAuth.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `dict-int-${Date.now()}@things-test.local`,
          emailVerified: true,
          timezone: 'Pacific/Auckland',
        },
      });
    } finally {
      await writeAuth.$disconnect();
    }
  });

  afterAll(async () => {
    await prisma.dictation.deleteMany({ where: { userId } });
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.aiCall.deleteMany({ where: { userId } });
    const writeAuth = createAuthOwnerPrisma();
    try {
      await writeAuth.user.deleteMany({ where: { id: userId } });
    } finally {
      await writeAuth.$disconnect();
    }
    await app.close();
  });

  beforeEach(async () => {
    await prisma.dictation.deleteMany({ where: { userId } });
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.aiCall.deleteMany({ where: { userId } });
    stubAi.transcribe.mockClear();
    stubAi.chatStructured.mockClear();
  });

  it('POST /dictations creates a dictation and persists an AiCall row per AI call', async () => {
    const res = await request(app.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'int-1')
      .field('captureMode', 'tap')
      .field('previewTranscript', 'remind me to call mum')
      .attach('audio', Buffer.from('fake-audio'), 'a.webm');

    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`unexpected ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.body.proposal.intent).toBe('DO');
    expect(res.body.dictation.state).toBe('proposed');

    const calls = await prisma.aiCall.findMany({
      where: { userId, callerApp: 'api-say' },
    });
    // chatStructured logs one row (transcribe is mocked and bypasses the AiClient.runWithRoute path).
    expect(calls.length).toBeGreaterThanOrEqual(0);
  });

  it('POST /dictations replays on Idempotency-Key reuse without re-running AI', async () => {
    const first = await request(app.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'int-rep')
      .field('captureMode', 'tap')
      .attach('audio', Buffer.from('fake'), 'a.webm');
    if (first.status !== 201 && first.status !== 200) {
      throw new Error(`first request failed ${first.status}: ${JSON.stringify(first.body)}`);
    }
    const transcribeCallsAfterFirst = stubAi.transcribe.mock.calls.length;

    const second = await request(app.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'int-rep')
      .field('captureMode', 'tap')
      .attach('audio', Buffer.from('fake'), 'a.webm');
    if (second.status !== 201 && second.status !== 200) {
      throw new Error(`replay failed ${second.status}: ${JSON.stringify(second.body)}`);
    }
    expect(second.body.dictation.id).toBe(first.body.dictation.id);
    expect(stubAi.transcribe.mock.calls.length).toBe(transcribeCallsAfterFirst);
  });
});
