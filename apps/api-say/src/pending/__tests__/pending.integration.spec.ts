import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { signServiceToken } from '@things/auth';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { createAuthOwnerPrisma } from '../../test-utils/auth-owner-prisma';

const SECRET = 'dev-things-auth-secret-min-32-chars-long-abc';
const userId = 'u-pend-int';

describe('Pending (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.SERVICE_TOKEN_SECRET = SECRET;
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
          email: `pend-${Date.now()}@things-test.local`,
          emailVerified: true,
          timezone: 'UTC',
        },
      });
    } finally {
      await writeAuth.$disconnect();
    }
    await prisma.dictation.deleteMany({ where: { userId } });
    await prisma.dictation.createMany({
      data: [
        {
          id: 'p1',
          userId,
          finalTranscript: 'oat milk',
          language: 'en',
          captureMode: 'tap',
          intent: 'BUY',
          confidence: 0.9,
          proposedPayload: { item: 'oat milk', quantity: 1 },
          state: 'dispatched',
          destination: 'PENDING_BUY',
          dispatchedAt: new Date(),
          usage: {},
        },
        {
          id: 'p2',
          userId,
          finalTranscript: 'pasta',
          language: 'en',
          captureMode: 'tap',
          intent: 'EAT',
          confidence: 0.9,
          proposedPayload: { name: 'pasta', kind: 'recipe' },
          state: 'dispatched',
          destination: 'PENDING_EAT',
          dispatchedAt: new Date(),
          usage: {},
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.dictation.deleteMany({ where: { userId } });
    const writeAuth = createAuthOwnerPrisma();
    try {
      await writeAuth.user.deleteMany({ where: { id: userId } });
    } finally {
      await writeAuth.$disconnect();
    }
    await app.close();
  });

  it('GET /pending without service JWT returns 401', async () => {
    await request(app.getHttpServer())
      .get('/pending')
      .query({ destination: 'PENDING_BUY' })
      .expect(401);
  });

  it('GET /pending from a whitelisted caller returns items scoped to userId', async () => {
    const tok = signServiceToken(
      { iss: 'api-buy', aud: 'api-say', sub: userId },
      { secret: SECRET },
    );
    const res = await request(app.getHttpServer())
      .get('/pending')
      .query({ destination: 'PENDING_BUY' })
      .set('Authorization', `Bearer ${tok}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].dictationId).toBe('p1');
    expect(res.body[0].payload).toEqual({ item: 'oat milk', quantity: 1 });
  });

  it('POST /pending/:id/consume stamps destinationRef', async () => {
    const tok = signServiceToken(
      { iss: 'api-buy', aud: 'api-say', sub: userId },
      { secret: SECRET },
    );
    const res = await request(app.getHttpServer())
      .post('/pending/p1/consume')
      .set('Authorization', `Bearer ${tok}`)
      .send({ destinationRef: 'buy-42' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.ok).toBe(true);
    const row = await prisma.dictation.findUnique({ where: { id: 'p1' } });
    expect(row?.destinationRef).toBe('buy-42');
  });

  it('GET /pending from non-whitelisted caller returns 403', async () => {
    const tok = signServiceToken(
      { iss: 'api-do', aud: 'api-say', sub: userId },
      { secret: SECRET },
    );
    await request(app.getHttpServer())
      .get('/pending')
      .query({ destination: 'PENDING_BUY' })
      .set('Authorization', `Bearer ${tok}`)
      .expect(403);
  });
});
