/**
 * Integration test for the Better Auth endpoints.
 *
 * Boots a real NestJS app against the SQLite dev DB (things_auth.db).
 * Requires the DB to be created (prisma db push) before running.
 * The test cleans up the user it creates to avoid cross-run pollution.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { prisma } from '../auth';

const TEST_EMAIL = `integration-test-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';

describe('Better Auth endpoints (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Clean up the test user so the test is idempotent
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /auth/sign-up/email — returns 200 and a set-cookie header', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/sign-up/email')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Integration Test' })
      .expect((r) => {
        // Better Auth returns 200 on success
        if (r.status !== 200) {
          throw new Error(`Expected 200 but got ${r.status}: ${JSON.stringify(r.body)}`);
        }
      });

    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('POST /auth/sign-in/email — returns 200 and a session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in/email')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect((r) => {
        if (r.status !== 200) {
          throw new Error(`Expected 200 but got ${r.status}: ${JSON.stringify(r.body)}`);
        }
      });

    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body).toHaveProperty('user');
  });

  it('GET /auth/get-session — returns 401 / null when no cookie sent', async () => {
    const res = await request(app.getHttpServer()).get('/auth/get-session');

    // Better Auth returns 401 when no valid session
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      // If 200, body should be null or have no user
      expect(res.body === null || !res.body?.user).toBe(true);
    }
  });

  it('health check still works after auth module load', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-auth' });
  });

  it('persists timezone on signup', async () => {
    const tzEmail = `tz-integration-${Date.now()}@things-test.local`;
    try {
      await request(app.getHttpServer())
        .post('/auth/sign-up/email')
        .send({
          email: tzEmail,
          password: TEST_PASSWORD,
          name: 'TZ User',
          timezone: 'Pacific/Auckland',
        })
        .expect((r) => {
          if (r.status !== 200) {
            throw new Error(`Expected 200 but got ${r.status}: ${JSON.stringify(r.body)}`);
          }
        });
      const user = await prisma.user.findUnique({ where: { email: tzEmail } });
      expect((user as { timezone?: string } | null)?.timezone).toBe('Pacific/Auckland');
    } finally {
      await prisma.user.deleteMany({ where: { email: tzEmail } });
    }
  });
});
