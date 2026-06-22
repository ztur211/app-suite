/**
 * Integration test for POST /sync (pull SEND intents from api-say).
 *
 * The SaySdk is replaced with a fake via `.overrideProvider`, so no cross-app
 * HTTP happens; the test verifies auth-gating + that a PENDING_SEND item
 * becomes an email draft Message in the testcontainer DB.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { SaySdk } from '@things/say-sdk';
import { AppModule } from '../../app.module';
import { authPrisma } from '../../auth/auth';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClient as AuthPrismaClient } from '../../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

const TEST_EMAIL = `sync-integration-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';
const DICTATION_ID = `d-sync-${Date.now()}`;

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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Sync Integration' },
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

describe('Send <- Say sync (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookie: string;

  const list = jest.fn(async () => [
    {
      dictationId: DICTATION_ID,
      createdAt: new Date(0).toISOString(),
      transcript: 'email sarah hello',
      payload: { subject: 'Hi Sarah', body: 'Hello!', recipientHint: 'sarah@example.com' },
    },
  ]);
  const consume = jest.fn(async () => ({ ok: true as const }));

  beforeAll(async () => {
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SaySdk)
      .useValue({ pending: { list, consume } })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
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

  it('POST /sync without a cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/sync').expect(401);
  });

  it('pulls a PENDING_SEND item into an email draft', async () => {
    const res = await request(app.getHttpServer())
      .post('/sync')
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(res.body).toEqual({ created: 1, consumed: 1 });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ destination: 'PENDING_SEND' }));
    expect(consume).toHaveBeenCalled();

    const list2 = await request(app.getHttpServer())
      .get('/messages')
      .set('Cookie', sessionCookie)
      .expect(200);
    const draft = (
      list2.body as { subject: string; channel: string; sourceDictationId: string }[]
    ).find((m) => m.sourceDictationId === DICTATION_ID);
    expect(draft?.subject).toBe('Hi Sarah');
    expect(draft?.channel).toBe('email');
  });
});
