/**
 * Integration tests for the Messages CRUD endpoints.
 *
 * api-send runs against a Postgres testcontainer (provisioned in
 * jest.integration.globalSetup.ts). The runtime instance uses two Prisma
 * clients: PrismaService writes Messages to things_send, and `authPrisma`
 * (in src/auth/auth.ts) reads Sessions from things_auth via the read-only
 * auth_reader role.
 *
 * Sign-up cannot use api-send's own Better Auth instance — that instance is
 * read-only by design. The test instead spins up a temporary write-enabled
 * Better Auth pointed at the auth_owner URL (stashed by globalSetup) and
 * uses it just to sign the test user up + mint a session cookie.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { AppModule } from '../../app.module';
import { authPrisma } from '../../auth/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClient as AuthPrismaClient } from '../../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

const TEST_EMAIL = `messages-integration-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';

async function getSignedSessionCookie(): Promise<string> {
  const ownerUrl = globalThis.__THINGS_AUTH_OWNER_URL__;
  if (!ownerUrl) throw new Error('globalSetup did not stash __THINGS_AUTH_OWNER_URL__');

  const writeAuthPrisma = new AuthPrismaClient({ datasources: { db: { url: ownerUrl } } });
  const writeAuth = betterAuth({
    database: prismaAdapter(writeAuthPrisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    secret: process.env['BETTER_AUTH_SECRET']!,
    basePath: '/auth',
  });

  try {
    const res = await writeAuth.api.signUpEmail({
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Messages Integration' },
      headers: new Headers({ 'Content-Type': 'application/json' }),
      asResponse: true,
    });
    const setCookies = res.headers.get('set-cookie') ?? '';
    const match = setCookies.match(/better-auth\.session_token=([^;]+)/);
    if (!match) throw new Error(`No session cookie in sign-up response. Headers: ${setCookies}`);
    return `better-auth.session_token=${match[1]}`;
  } finally {
    await writeAuthPrisma.$disconnect();
  }
}

describe('Messages CRUD (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let createdMessageId: string;

  beforeAll(async () => {
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up Messages via the domain client and the test user via the
    // auth_owner URL (api-send's authPrisma is read-only and can't delete).
    const ownerUrl = globalThis.__THINGS_AUTH_OWNER_URL__;
    if (ownerUrl) {
      const writeAuthPrisma = new AuthPrismaClient({ datasources: { db: { url: ownerUrl } } });
      try {
        const user = await writeAuthPrisma.user.findUnique({ where: { email: TEST_EMAIL } });
        if (user) await prisma.message.deleteMany({ where: { userId: user.id } });
        await writeAuthPrisma.user.deleteMany({ where: { email: TEST_EMAIL } });
      } finally {
        await writeAuthPrisma.$disconnect();
      }
    }
    await app.close();
    await authPrisma.$disconnect();
  });

  it('GET /messages without cookie returns 401', async () => {
    await request(app.getHttpServer()).get('/messages').expect(401);
  });

  it('POST /messages creates an outbound draft and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/messages')
      .set('Cookie', sessionCookie)
      .send({
        channel: 'email',
        subject: 'Lunch?',
        body: 'Are we still on for noon?',
        recipient: 'friend@example.com',
        sourceDictationId: 'd-test-1',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.channel).toBe('email');
    expect(res.body.subject).toBe('Lunch?');
    expect(res.body.body).toBe('Are we still on for noon?');
    expect(res.body.recipient).toBe('friend@example.com');
    expect(res.body.sourceDictationId).toBe('d-test-1');
    // Service forces these regardless of request body.
    expect(res.body.kind).toBe('outbound');
    expect(res.body.status).toBe('draft');
    createdMessageId = res.body.id as string;
  });

  it('GET /messages returns the created message', async () => {
    const res = await request(app.getHttpServer())
      .get('/messages')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { id: string }[]).find((m) => m.id === createdMessageId);
    expect(found).toBeDefined();
  });

  it('PATCH /messages/:id can change channel from email to slack', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/messages/${createdMessageId}`)
      .set('Cookie', sessionCookie)
      .send({ channel: 'slack' })
      .expect(200);

    expect(res.body.channel).toBe('slack');
  });

  it('PATCH /messages/:id transitions status from draft to sent', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/messages/${createdMessageId}`)
      .set('Cookie', sessionCookie)
      .send({ status: 'sent' })
      .expect(200);

    expect(res.body.status).toBe('sent');
  });

  it('PATCH /messages/:id can clear subject by passing null', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/messages/${createdMessageId}`)
      .set('Cookie', sessionCookie)
      .send({ subject: null })
      .expect(200);

    expect(res.body.subject).toBeNull();
  });

  it('DELETE /messages/:id deletes the message', async () => {
    await request(app.getHttpServer())
      .delete(`/messages/${createdMessageId}`)
      .set('Cookie', sessionCookie)
      .expect(200);
  });

  it('GET /messages no longer returns the deleted message', async () => {
    const res = await request(app.getHttpServer())
      .get('/messages')
      .set('Cookie', sessionCookie)
      .expect(200);

    const found = (res.body as { id: string }[]).find((m) => m.id === createdMessageId);
    expect(found).toBeUndefined();
  });

  it('PATCH /messages/:id for non-existent id returns 404', async () => {
    await request(app.getHttpServer())
      .patch('/messages/non-existent-id')
      .set('Cookie', sessionCookie)
      .send({ body: 'nope' })
      .expect(404);
  });

  it('GET /health still returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-send' });
  });
});
