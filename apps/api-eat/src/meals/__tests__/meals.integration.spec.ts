/**
 * Integration tests for the Meals CRUD endpoints.
 *
 * api-eat runs against a Postgres testcontainer (provisioned in
 * jest.integration.globalSetup.ts). The runtime instance uses two Prisma
 * clients: PrismaService writes MealItems to things_eat, and `authPrisma`
 * (in src/auth/auth.ts) reads Sessions from things_auth via the read-only
 * auth_reader role.
 *
 * Sign-up cannot use api-eat's own Better Auth instance — that instance is
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

const TEST_EMAIL = `meals-integration-${Date.now()}@things-test.local`;
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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Meals Integration' },
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

describe('Meals CRUD (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let createdMealId: string;

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
    // Clean up MealItems via the domain client and the test user via the
    // auth_owner URL (api-eat's authPrisma is read-only and can't delete).
    const ownerUrl = globalThis.__THINGS_AUTH_OWNER_URL__;
    if (ownerUrl) {
      const writeAuthPrisma = new AuthPrismaClient({ datasources: { db: { url: ownerUrl } } });
      try {
        const user = await writeAuthPrisma.user.findUnique({ where: { email: TEST_EMAIL } });
        if (user) await prisma.mealItem.deleteMany({ where: { userId: user.id } });
        await writeAuthPrisma.user.deleteMany({ where: { email: TEST_EMAIL } });
      } finally {
        await writeAuthPrisma.$disconnect();
      }
    }
    await app.close();
    await authPrisma.$disconnect();
  });

  it('GET /meals without cookie returns 401', async () => {
    await request(app.getHttpServer()).get('/meals').expect(401);
  });

  it('POST /meals creates a meal with all fields and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/meals')
      .set('Cookie', sessionCookie)
      .send({
        name: 'Carbonara',
        kind: 'recipe',
        notes: 'guanciale, no cream',
        sourceDictationId: 'd-test-1',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Carbonara');
    expect(res.body.kind).toBe('recipe');
    expect(res.body.notes).toBe('guanciale, no cream');
    expect(res.body.sourceDictationId).toBe('d-test-1');
    expect(res.body.status).toBe('active');
    createdMealId = res.body.id as string;
  });

  it('GET /meals returns the created meal', async () => {
    const res = await request(app.getHttpServer())
      .get('/meals')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { id: string }[]).find((m) => m.id === createdMealId);
    expect(found).toBeDefined();
  });

  it('PATCH /meals/:id can change kind from recipe to restaurant', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/meals/${createdMealId}`)
      .set('Cookie', sessionCookie)
      .send({ kind: 'restaurant' })
      .expect(200);

    expect(res.body.kind).toBe('restaurant');
  });

  it('PATCH /meals/:id updates status from active to tried', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/meals/${createdMealId}`)
      .set('Cookie', sessionCookie)
      .send({ status: 'tried' })
      .expect(200);

    expect(res.body.status).toBe('tried');
  });

  it('PATCH /meals/:id can clear notes by passing null', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/meals/${createdMealId}`)
      .set('Cookie', sessionCookie)
      .send({ notes: null })
      .expect(200);

    expect(res.body.notes).toBeNull();
  });

  it('DELETE /meals/:id deletes the meal', async () => {
    await request(app.getHttpServer())
      .delete(`/meals/${createdMealId}`)
      .set('Cookie', sessionCookie)
      .expect(200);
  });

  it('GET /meals no longer returns the deleted meal', async () => {
    const res = await request(app.getHttpServer())
      .get('/meals')
      .set('Cookie', sessionCookie)
      .expect(200);

    const found = (res.body as { id: string }[]).find((m) => m.id === createdMealId);
    expect(found).toBeUndefined();
  });

  it('PATCH /meals/:id for non-existent id returns 404', async () => {
    await request(app.getHttpServer())
      .patch('/meals/non-existent-id')
      .set('Cookie', sessionCookie)
      .send({ name: 'nope' })
      .expect(404);
  });

  it('GET /health still returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-eat' });
  });
});
