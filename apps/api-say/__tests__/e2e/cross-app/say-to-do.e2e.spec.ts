/**
 * Cross-app e2e: Say Things -> Do Things contract.
 *
 * Boots api-do and api-say in-process against a 3-app testcontainer
 * (things_auth + things_do + things_say). DATABASE_URL is switched between
 * the two Test.createTestingModule calls — but note that Prisma's query
 * engine reads DATABASE_URL lazily at first query (or at $connect()), not
 * at `new PrismaClient()`. So the env-var swap pattern only works when
 * each app captures its URL before the next swap:
 *   - api-do: TasksModule's useFactory passes `datasources.db.url`
 *     explicitly so the URL is pinned at construction.
 *   - api-say: PrismaService's $connect() in onModuleInit fires during
 *     sayApp.init() below, before the test issues any request, so its
 *     engine spawns while DATABASE_URL still points at things_say.
 *
 * Exercises the full dispatch path: a typed dictation goes through
 * DispatchService -> DoHandler -> DoSdk -> real HTTP -> api-do TasksService
 * -> things_do. Asserts the Task lands with source provenance, then DELETE
 * /:id/dispatch undoes it.
 */
import 'reflect-metadata';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { Client } from 'pg';
import { AiClient } from '@things/ai';
import type { SuitePostgres } from '@things/testing';
import { createAuthOwnerPrisma } from '../../../src/test-utils/auth-owner-prisma';

declare global {
  var __THINGS_E2E_PG__: SuitePostgres | undefined;
  var __THINGS_AUTH_OWNER_URL__: string | undefined;
}

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

const USER_ID = 'u-cross-e2e';

describe('Cross-app: Say -> Do (e2e contract)', () => {
  let sayApp: INestApplication;
  let doApp: INestApplication;
  let doDb: Client;
  let stubAi: StubAi;
  let tmpDir: string;

  beforeAll(async () => {
    const suite = globalThis.__THINGS_E2E_PG__;
    if (!suite) throw new Error('e2e globalSetup did not run');

    // Seed the user into things_auth so api-say's session stub can refer to
    // a real id (the cross-app flow doesn't query users directly, but
    // keeping the DB consistent matches production).
    const writeAuth = createAuthOwnerPrisma();
    try {
      await writeAuth.user.upsert({
        where: { id: USER_ID },
        update: {},
        create: {
          id: USER_ID,
          email: `cross-e2e-${Date.now()}@things-test.local`,
          emailVerified: true,
          timezone: 'Pacific/Auckland',
        },
      });
    } finally {
      await writeAuth.$disconnect();
    }

    // --- Boot api-do first ---
    // Pin DATABASE_URL to things_do so TasksModule's useFactory captures it
    // into the PrismaClient's `datasources` at construction. Without that
    // explicit capture, the engine would resolve DATABASE_URL lazily at
    // first query — after we mutate it to things_say below — and api-do
    // would query the wrong DB.
    process.env['DATABASE_URL'] = suite.urls.do;
    const { AppModule: DoAppModule } = await import('../../../../api-do/src/app.module');
    const doMod = await Test.createTestingModule({ imports: [DoAppModule] }).compile();
    doApp = doMod.createNestApplication();
    await doApp.listen(0);
    const doAddr = doApp.getHttpServer().address() as AddressInfo;
    const doApiUrl = `http://localhost:${doAddr.port}`;

    // --- Then boot api-say ---
    // Switch DATABASE_URL to things_say; api-say's PrismaService spawns its
    // engine in onModuleInit (via $connect()) when sayApp.init() runs below,
    // capturing this URL before any later mutations. Also point the DoSdk
    // at the real api-do server we just started.
    process.env['DATABASE_URL'] = suite.urls.say;
    process.env['DO_API_URL'] = doApiUrl;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'say-e2e-'));
    process.env['TMP_AUDIO_DIR'] = tmpDir;

    stubAi = new StubAi();
    stubAi.transcribe.mockResolvedValue({
      text: 'remind me to call mum',
      segments: [],
      language: 'en',
      usage: { kind: 'audio', seconds: 0 },
    });
    stubAi.chatStructured.mockResolvedValue({
      value: { intent: 'DO', payload: { title: 'Call mum', dueAt: null }, confidence: 0.95 },
      usage: { kind: 'tokens', inputTokens: 100, outputTokens: 20 },
    });

    const { AppModule: SayAppModule } = await import('../../../src/app.module');
    const { SessionGuard } = await import('../../../src/auth/session.guard');

    const sayMod = await Test.createTestingModule({ imports: [SayAppModule] })
      .overrideProvider(AiClient)
      .useValue(stubAi)
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.session = {
            user: { id: USER_ID, email: 'cross@x', timezone: 'Pacific/Auckland' },
            session: { id: 's-e2e', userId: USER_ID, expiresAt: new Date(Date.now() + 60_000) },
          };
          req.userId = USER_ID;
          return true;
        },
      })
      .compile();
    sayApp = sayMod.createNestApplication();
    await sayApp.init();

    // Direct pg client for asserting on api-do's DB (avoids needing a real
    // session to call api-do's GET /tasks).
    doDb = new Client({ connectionString: suite.urls.do });
    await doDb.connect();
  });

  afterAll(async () => {
    if (sayApp) await sayApp.close();
    if (doApp) await doApp.close();
    if (doDb) await doDb.end();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await doDb.query('DELETE FROM "Task" WHERE "userId" = $1', [USER_ID]);
  });

  it('dispatches DO intent -> Task lands in api-do with source provenance, then undoes cleanly', async () => {
    const create = await request(sayApp.getHttpServer())
      .post('/dictations')
      .set('Idempotency-Key', 'd-cross-1')
      .field('captureMode', 'type')
      .field('previewTranscript', 'remind me to call mum');
    if (create.status !== 200 && create.status !== 201) {
      throw new Error(`POST /dictations failed ${create.status}: ${JSON.stringify(create.body)}`);
    }
    const dictationId: string = create.body.dictation.id;
    expect(create.body.proposal.intent).toBe('DO');

    const dispatch = await request(sayApp.getHttpServer())
      .post(`/dictations/${dictationId}/dispatch`)
      .set('Idempotency-Key', 'd-cross-1-dispatch');
    if (dispatch.status !== 200 && dispatch.status !== 201) {
      throw new Error(`dispatch failed ${dispatch.status}: ${JSON.stringify(dispatch.body)}`);
    }

    const tasks = await doDb.query<{ id: string; title: string; source: unknown }>(
      'SELECT id, title, source FROM "Task" WHERE "userId" = $1',
      [USER_ID],
    );
    expect(tasks.rows).toHaveLength(1);
    expect(tasks.rows[0].title).toBe('Call mum');
    expect(tasks.rows[0].source).toEqual({ app: 'say-things', dictationId });

    const undo = await request(sayApp.getHttpServer())
      .delete(`/dictations/${dictationId}/dispatch`)
      .set('Idempotency-Key', 'd-cross-1-undo');
    if (undo.status !== 200 && undo.status !== 201) {
      throw new Error(`undo failed ${undo.status}: ${JSON.stringify(undo.body)}`);
    }

    const afterUndo = await doDb.query('SELECT id FROM "Task" WHERE "userId" = $1', [USER_ID]);
    expect(afterUndo.rows).toHaveLength(0);
  });
});
