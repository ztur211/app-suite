/**
 * Integration tests for the Tasks CRUD endpoints.
 *
 * Boots a real NestJS app against the real SQLite DB (things_auth.db).
 * Signs up a test user via Better Auth's internal API to get a properly
 * signed session cookie. Cleans up after itself.
 *
 * Requires:
 *   - apps/api-do/.env with DATABASE_URL pointing at things_auth.db
 *   - apps/api-auth/things_auth.db to exist (run prisma db push first)
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { auth, prisma } from '../auth/auth';

const TEST_EMAIL = `tasks-integration-${Date.now()}@things-test.local`;
const TEST_PASSWORD = 'TestPass123!';

/**
 * Signs up via Better Auth's internal API and extracts the signed session cookie.
 * This ensures we use the real HMAC-signed cookie format that Better Auth validates.
 */
async function getSignedSessionCookie(): Promise<string> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const res = await auth.api.signUpEmail({
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Integration Test' },
    headers,
    asResponse: true,
  });

  const setCookies = res.headers.get('set-cookie') ?? '';
  // Extract the better-auth.session_token cookie value
  const match = setCookies.match(/better-auth\.session_token=([^;]+)/);
  if (!match) {
    throw new Error(`No session cookie in sign-up response. Headers: ${setCookies}`);
  }
  return `better-auth.session_token=${match[1]}`;
}

describe('Tasks CRUD (integration)', () => {
  let app: INestApplication;
  let sessionCookie: string;
  let createdTaskId: string;

  beforeAll(async () => {
    // Get a real signed session cookie via Better Auth
    sessionCookie = await getSignedSessionCookie();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Clean up: find user then delete tasks and user
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (user) {
      await prisma.task.deleteMany({ where: { userId: user.id } });
    }
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await app.close();
    await prisma.$disconnect();
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
