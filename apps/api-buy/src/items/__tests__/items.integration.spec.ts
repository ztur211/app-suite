/**
 * Integration tests for the Items CRUD endpoints.
 *
 * api-buy runs against a Postgres testcontainer (provisioned in
 * jest.integration.globalSetup.ts). The runtime instance uses two Prisma
 * clients: PrismaService writes ShoppingItems to things_buy, and
 * `authPrisma` (in src/auth/auth.ts) reads Sessions from things_auth via the
 * read-only auth_reader role.
 *
 * Sign-up cannot use api-buy's own Better Auth instance — that instance is
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

const TEST_EMAIL = `items-integration-${Date.now()}@things-test.local`;
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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Items Integration' },
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

describe('Items CRUD (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookie: string;
  let createdItemId: string;

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
    // Clean up ShoppingItems via the domain client and the test user via the
    // auth_owner URL (api-buy's authPrisma is read-only and can't delete).
    const ownerUrl = globalThis.__THINGS_AUTH_OWNER_URL__;
    if (ownerUrl) {
      const writeAuthPrisma = new AuthPrismaClient({ datasources: { db: { url: ownerUrl } } });
      try {
        const user = await writeAuthPrisma.user.findUnique({ where: { email: TEST_EMAIL } });
        if (user) await prisma.shoppingItem.deleteMany({ where: { userId: user.id } });
        await writeAuthPrisma.user.deleteMany({ where: { email: TEST_EMAIL } });
      } finally {
        await writeAuthPrisma.$disconnect();
      }
    }
    await app.close();
    await authPrisma.$disconnect();
  });

  it('GET /items without cookie returns 401', async () => {
    await request(app.getHttpServer()).get('/items').expect(401);
  });

  it('POST /items creates an item with all fields and returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/items')
      .set('Cookie', sessionCookie)
      .send({
        title: 'Milk',
        quantity: 2,
        notes: 'whole, organic',
        sourceDictationId: 'd-test-1',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Milk');
    expect(res.body.quantity).toBe(2);
    expect(res.body.notes).toBe('whole, organic');
    expect(res.body.sourceDictationId).toBe('d-test-1');
    expect(res.body.status).toBe('active');
    createdItemId = res.body.id as string;
  });

  it('GET /items returns the created item', async () => {
    const res = await request(app.getHttpServer())
      .get('/items')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const found = (res.body as { id: string }[]).find((i) => i.id === createdItemId);
    expect(found).toBeDefined();
  });

  it('PATCH /items/:id updates status from active to bought', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/items/${createdItemId}`)
      .set('Cookie', sessionCookie)
      .send({ status: 'bought' })
      .expect(200);

    expect(res.body.status).toBe('bought');
  });

  it('PATCH /items/:id can clear quantity by passing null', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/items/${createdItemId}`)
      .set('Cookie', sessionCookie)
      .send({ quantity: null })
      .expect(200);

    expect(res.body.quantity).toBeNull();
  });

  it('DELETE /items/:id deletes the item', async () => {
    await request(app.getHttpServer())
      .delete(`/items/${createdItemId}`)
      .set('Cookie', sessionCookie)
      .expect(200);
  });

  it('PATCH /items/:id for non-existent id returns 404', async () => {
    await request(app.getHttpServer())
      .patch('/items/non-existent-id')
      .set('Cookie', sessionCookie)
      .send({ title: 'nope' })
      .expect(404);
  });

  it('GET /health still returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-buy' });
  });
});
