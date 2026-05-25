import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { verifyServiceToken } from '@things/auth';
import { DoSdk } from '../index';

const SECRET = 'test-service-token-secret-min-32-chars-long-aaa';

function makeSdk(): { sdk: DoSdk; axiosMock: MockAdapter } {
  const http = axios.create({ baseURL: 'http://api-do.test' });
  const axiosMock = new MockAdapter(http);
  const sdk = new DoSdk({
    baseUrl: 'http://api-do.test',
    callerApp: 'api-say',
    serviceTokenSecret: SECRET,
    http,
  });
  return { sdk, axiosMock };
}

describe('DoSdk.tasks', () => {
  describe('create', () => {
    it('POSTs to /tasks with title + dueAt and returns the created task', async () => {
      const { sdk, axiosMock } = makeSdk();
      axiosMock.onPost('/tasks').reply((config) => {
        const body = JSON.parse(config.data);
        expect(body).toEqual({
          title: 'Email Jamie',
          dueAt: '2026-05-23T17:00:00.000Z',
        });
        return [
          201,
          {
            id: 't1',
            userId: 'u1',
            title: 'Email Jamie',
            completed: false,
            dueAt: '2026-05-23T17:00:00.000Z',
          },
        ];
      });
      const result = await sdk.tasks.create({
        userId: 'u1',
        title: 'Email Jamie',
        dueAt: '2026-05-23T17:00:00.000Z',
      });
      expect(result.id).toBe('t1');
      expect(result.title).toBe('Email Jamie');
    });

    it('sends a service JWT in the Authorization header tagged for api-do with userId as sub', async () => {
      const { sdk, axiosMock } = makeSdk();
      let capturedHeader: string | undefined;
      axiosMock.onPost('/tasks').reply((config) => {
        capturedHeader = config.headers?.['Authorization'] as string | undefined;
        return [201, { id: 't1' }];
      });
      await sdk.tasks.create({ userId: 'u_42', title: 'X', dueAt: null });
      expect(capturedHeader).toMatch(/^Bearer /);
      const token = (capturedHeader ?? '').slice('Bearer '.length);
      const payload = verifyServiceToken(token, { secret: SECRET, expectedAud: 'api-do' });
      expect(payload.iss).toBe('api-say');
      expect(payload.aud).toBe('api-do');
      expect(payload.sub).toBe('u_42');
    });

    it('accepts a null dueAt', async () => {
      const { sdk, axiosMock } = makeSdk();
      axiosMock.onPost('/tasks').reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.dueAt).toBeNull();
        return [201, { id: 't2' }];
      });
      const result = await sdk.tasks.create({ userId: 'u1', title: 'X', dueAt: null });
      expect(result.id).toBe('t2');
    });
  });

  describe('delete', () => {
    it('DELETEs /tasks/:id and returns { ok: true }', async () => {
      const { sdk, axiosMock } = makeSdk();
      axiosMock.onDelete('/tasks/t1').reply(200, { ok: true });
      const result = await sdk.tasks.delete({ userId: 'u1', taskId: 't1' });
      expect(result.ok).toBe(true);
    });

    it('sends a service JWT in the Authorization header', async () => {
      const { sdk, axiosMock } = makeSdk();
      let capturedHeader: string | undefined;
      axiosMock.onDelete('/tasks/t1').reply((config) => {
        capturedHeader = config.headers?.['Authorization'] as string | undefined;
        return [200, { ok: true }];
      });
      await sdk.tasks.delete({ userId: 'u_42', taskId: 't1' });
      expect(capturedHeader).toMatch(/^Bearer /);
      const payload = verifyServiceToken((capturedHeader ?? '').slice('Bearer '.length), {
        secret: SECRET,
        expectedAud: 'api-do',
      });
      expect(payload.iss).toBe('api-say');
      expect(payload.sub).toBe('u_42');
    });
  });

  it('forwards source field on create for cross-app provenance', async () => {
    const { sdk, axiosMock } = makeSdk();
    let receivedBody: { source?: { app: string; dictationId?: string } } | undefined;
    axiosMock.onPost('/tasks').reply((config) => {
      receivedBody = JSON.parse(config.data);
      return [201, { id: 't1' }];
    });
    const result = await sdk.tasks.create({
      userId: 'u1',
      title: 'Email Jamie',
      dueAt: null,
      source: { app: 'say-things', dictationId: 'd1' },
    });
    expect(receivedBody?.source).toEqual({ app: 'say-things', dictationId: 'd1' });
    expect(result.id).toBe('t1');
  });

  it('uses the audience override when provided', async () => {
    const http = axios.create({ baseURL: 'http://api-do.test' });
    const axiosMock = new MockAdapter(http);
    const sdk = new DoSdk({
      baseUrl: 'http://api-do.test',
      callerApp: 'api-say',
      serviceTokenSecret: SECRET,
      audience: 'api-do-staging',
      http,
    });
    let header: string | undefined;
    axiosMock.onPost('/tasks').reply((config) => {
      header = config.headers?.['Authorization'] as string | undefined;
      return [201, { id: 't1' }];
    });
    await sdk.tasks.create({ userId: 'u1', title: 'X', dueAt: null });
    const payload = verifyServiceToken((header ?? '').slice('Bearer '.length), {
      secret: SECRET,
      expectedAud: 'api-do-staging',
    });
    expect(payload.aud).toBe('api-do-staging');
  });
});
