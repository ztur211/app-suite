/**
 * Integration test for POST /items/search.
 *
 * The external product provider is replaced with a fake via
 * `.overrideProvider(ProductSearchProvider)`, so this test makes NO network
 * calls — it verifies auth-gating, request wiring, and the response shape.
 * Session cookie minting mirrors items.integration.spec.ts.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { AppModule } from '../../app.module';
import { authPrisma } from '../../auth/auth';
import { ProductSearchProvider, type ProductResult } from '../product-search.provider';
import { PrismaClient as AuthPrismaClient } from '../../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

const TEST_EMAIL = `search-integration-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';

const FAKE_RESULTS: ProductResult[] = [
  {
    id: 'p1',
    title: 'Oat Milk',
    imageUrl: 'http://img/1.jpg',
    price: { amount: 4.5, currency: 'USD' },
    url: 'http://shop/p1',
    seller: 'Oatly',
    source: 'fake',
  },
];

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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Search Integration' },
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

describe('Product search (integration)', () => {
  let app: INestApplication;
  let sessionCookie: string;
  const search = jest.fn(async (q: string): Promise<ProductResult[]> => (q ? FAKE_RESULTS : []));

  beforeAll(async () => {
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProductSearchProvider)
      .useValue({ search })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    const ownerUrl = globalThis.__THINGS_AUTH_OWNER_URL__;
    if (ownerUrl) {
      const writeAuthPrisma = new AuthPrismaClient({ datasources: { db: { url: ownerUrl } } });
      try {
        await writeAuthPrisma.user.deleteMany({ where: { email: TEST_EMAIL } });
      } finally {
        await writeAuthPrisma.$disconnect();
      }
    }
    await app.close();
    await authPrisma.$disconnect();
  });

  it('POST /items/search without a cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/items/search').send({ query: 'milk' }).expect(401);
  });

  it('POST /items/search returns provider results', async () => {
    const res = await request(app.getHttpServer())
      .post('/items/search')
      .set('Cookie', sessionCookie)
      .send({ query: 'milk' })
      .expect(201);

    expect(res.body).toEqual(FAKE_RESULTS);
    expect(search).toHaveBeenCalledWith('milk', { limit: undefined });
  });

  it('POST /items/search with an empty query returns [] and does not hit the provider', async () => {
    search.mockClear();
    const res = await request(app.getHttpServer())
      .post('/items/search')
      .set('Cookie', sessionCookie)
      .send({ query: '   ' })
      .expect(201);

    expect(res.body).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
