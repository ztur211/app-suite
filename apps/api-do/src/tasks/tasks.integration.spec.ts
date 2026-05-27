/**
 * Integration tests for the Tasks CRUD endpoints.
 *
 * api-do runs against a Postgres testcontainer (provisioned in
 * jest.integration.globalSetup.ts). The runtime instance uses two Prisma
 * clients: `prisma` writes Tasks to things_do, `authPrisma` reads Sessions
 * from things_auth via the read-only auth_reader role.
 *
 * Sign-up cannot use api-do's own Better Auth instance — that instance is
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
import { AppModule } from '../app.module';
import { prisma, authPrisma } from '../auth/auth';
import { PrismaClient as AuthPrismaClient } from '../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

const TEST_EMAIL = `tasks-integration-${Date.now()}@things-test.local`;
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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Integration Test' },
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

describe('Tasks CRUD (integration)', () => {
  let app: INestApplication;
  let sessionCookie: string;
  let createdTaskId: string;

  beforeAll(async () => {
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Clean up Tasks via the domain client and the test user via the
    // auth_owner URL (api-do's authPrisma is read-only and can't delete).
    const ownerUrl = globalThis.__THINGS_AUTH_OWNER_URL__;
    if (ownerUrl) {
      const writeAuthPrisma = new AuthPrismaClient({ datasources: { db: { url: ownerUrl } } });
      try {
        const user = await writeAuthPrisma.user.findUnique({ where: { email: TEST_EMAIL } });
        if (user) await prisma.task.deleteMany({ where: { userId: user.id } });
        await writeAuthPrisma.user.deleteMany({ where: { email: TEST_EMAIL } });
      } finally {
        await writeAuthPrisma.$disconnect();
      }
    }
    await app.close();
    await prisma.$disconnect();
    await authPrisma.$disconnect();
  });

  it('GET /tasks without cookie returns 401', async () => {
    await request(app.getHttpServer()).get('/tasks').expect(401);
  });

  it('POST /tasks creates a task and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', sessionCookie)
      .send({ title: 'Integration test task' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Integration test task');
    expect(res.body.completed).toBe(false);
    createdTaskId = res.body.id as string;
  });

  it('GET /tasks returns the created task', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { id: string }[]).find((t) => t.id === createdTaskId);
    expect(found).toBeDefined();
  });

  it('PATCH /tasks/:id toggles completion to true', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${createdTaskId}`)
      .set('Cookie', sessionCookie)
      .send({ completed: true })
      .expect(200);

    expect(res.body.completed).toBe(true);
  });

  it('DELETE /tasks/:id deletes the task', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${createdTaskId}`)
      .set('Cookie', sessionCookie)
      .expect(200);
  });

  it('GET /tasks returns empty array after deletion', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .set('Cookie', sessionCookie)
      .expect(200);

    const found = (res.body as { id: string }[]).find((t) => t.id === createdTaskId);
    expect(found).toBeUndefined();
  });

  it('PATCH /tasks/:id for non-existent task returns 404', async () => {
    await request(app.getHttpServer())
      .patch('/tasks/non-existent-id')
      .set('Cookie', sessionCookie)
      .send({ completed: true })
      .expect(404);
  });

  it('GET /health still returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-do' });
  });
});
