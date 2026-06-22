/**
 * Integration test for POST /meals/search.
 *
 * Both discovery providers are replaced with fakes via `.overrideProvider`,
 * so this test makes NO network calls — it verifies auth-gating, kind routing,
 * and the response shape. Session cookie minting mirrors the meals tests.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { AppModule } from '../../app.module';
import { authPrisma } from '../../auth/auth';
import { RecipeProvider, RestaurantProvider, type DiscoveryResult } from '../discovery.provider';
import { PrismaClient as AuthPrismaClient } from '../../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

const TEST_EMAIL = `discovery-integration-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';

const RECIPE: DiscoveryResult = {
  id: 'r1',
  name: 'Teriyaki Chicken',
  imageUrl: null,
  kind: 'recipe',
  detail: 'Chicken · Japanese',
  url: null,
  source: 'fake',
};
const RESTAURANT: DiscoveryResult = {
  id: 'b1',
  name: 'Sushi Place',
  imageUrl: null,
  kind: 'restaurant',
  detail: '★ 4.5',
  url: null,
  source: 'fake',
};

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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Discovery Integration' },
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

describe('Meal discovery (integration)', () => {
  let app: INestApplication;
  let sessionCookie: string;
  const recipeSearch = jest.fn(async (): Promise<DiscoveryResult[]> => [RECIPE]);
  const restaurantSearch = jest.fn(async (): Promise<DiscoveryResult[]> => [RESTAURANT]);

  beforeAll(async () => {
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RecipeProvider)
      .useValue({ search: recipeSearch })
      .overrideProvider(RestaurantProvider)
      .useValue({ search: restaurantSearch })
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

  it('POST /meals/search without a cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/meals/search').send({ query: 'pasta' }).expect(401);
  });

  it('defaults to recipe discovery', async () => {
    const res = await request(app.getHttpServer())
      .post('/meals/search')
      .set('Cookie', sessionCookie)
      .send({ query: 'chicken' })
      .expect(201);

    expect(res.body).toEqual({ kind: 'recipe', results: [RECIPE] });
    expect(recipeSearch).toHaveBeenCalled();
  });

  it('routes kind=restaurant to the restaurant provider', async () => {
    const res = await request(app.getHttpServer())
      .post('/meals/search')
      .set('Cookie', sessionCookie)
      .send({ query: 'sushi', kind: 'restaurant', location: 'NYC' })
      .expect(201);

    expect(res.body).toEqual({ kind: 'restaurant', results: [RESTAURANT] });
  });

  it('an empty query returns [] without hitting a provider', async () => {
    recipeSearch.mockClear();
    const res = await request(app.getHttpServer())
      .post('/meals/search')
      .set('Cookie', sessionCookie)
      .send({ query: '   ', kind: 'recipe' })
      .expect(201);

    expect(res.body).toEqual({ kind: 'recipe', results: [] });
    expect(recipeSearch).not.toHaveBeenCalled();
  });
});
