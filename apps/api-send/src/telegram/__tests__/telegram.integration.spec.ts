/**
 * Integration test for the Telegram flow: link -> outbound send -> inbound sync.
 *
 * The TelegramAdapter is replaced with a fake via `.overrideProvider`, so no
 * network calls are made; the test exercises the real DB (testcontainer) for
 * TelegramLink / Message / TelegramInbound. Session minting mirrors the
 * messages integration test.
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
import { TelegramAdapter, type TelegramUpdate } from '../telegram.adapter';
import { PrismaClient as AuthPrismaClient } from '../../../prisma/generated/auth-client';

declare global {
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

const TEST_EMAIL = `telegram-integration-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';
const CHAT_ID = `chat-${Date.now()}`;
const UPDATE_ID = Date.now();

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
      body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Telegram Integration' },
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

describe('Telegram flow (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessionCookie: string;

  const sendMessage = jest.fn(async () => ({ providerMessageId: '555', chatId: CHAT_ID }));
  const getUpdates = jest.fn(
    async (): Promise<TelegramUpdate[]> => [
      { updateId: UPDATE_ID, chatId: CHAT_ID, fromUsername: 'me', text: 'hi back', date: 1 },
    ],
  );

  beforeAll(async () => {
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TelegramAdapter)
      .useValue({ sendMessage, getUpdates })
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
        if (user) {
          await prisma.message.deleteMany({ where: { userId: user.id } });
          await prisma.telegramLink.deleteMany({ where: { userId: user.id } });
        }
        await prisma.telegramInbound.deleteMany({ where: { chatId: CHAT_ID } });
        await writeAuthPrisma.user.deleteMany({ where: { email: TEST_EMAIL } });
      } finally {
        await writeAuthPrisma.$disconnect();
      }
    }
    await app.close();
    await authPrisma.$disconnect();
  });

  it('POST /telegram/link without a cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/telegram/link').send({ chatId: CHAT_ID }).expect(401);
  });

  it('links a Telegram chat to the user', async () => {
    const res = await request(app.getHttpServer())
      .post('/telegram/link')
      .set('Cookie', sessionCookie)
      .send({ chatId: CHAT_ID })
      .expect(201);
    expect(res.body).toEqual({ ok: true, chatId: CHAT_ID });
  });

  it('sends an outbound telegram message and marks it sent', async () => {
    const created = await request(app.getHttpServer())
      .post('/messages')
      .set('Cookie', sessionCookie)
      .send({ channel: 'telegram', body: 'hello', recipient: CHAT_ID })
      .expect(201);
    const id = created.body.id as string;

    const sent = await request(app.getHttpServer())
      .post(`/messages/${id}/send`)
      .set('Cookie', sessionCookie)
      .expect(201);

    expect(sendMessage).toHaveBeenCalledWith(CHAT_ID, 'hello');
    expect(sent.body.status).toBe('sent');
    expect(sent.body.providerMessageId).toBe('555');
  });

  it('syncs an inbound telegram update into a message', async () => {
    const res = await request(app.getHttpServer())
      .post('/messages/sync')
      .set('Cookie', sessionCookie)
      .expect(201);
    expect(res.body.inboundCreated).toBeGreaterThanOrEqual(1);

    const list = await request(app.getHttpServer())
      .get('/messages')
      .set('Cookie', sessionCookie)
      .expect(200);
    const inbound = (list.body as { kind: string; body: string }[]).find(
      (m) => m.kind === 'inbound',
    );
    expect(inbound?.body).toBe('hi back');
  });
});
