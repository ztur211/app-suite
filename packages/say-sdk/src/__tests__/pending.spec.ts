import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { verifyServiceToken } from '@things/auth';
import { SaySdk } from '../index';

const SECRET = 'test-service-token-secret-min-32-chars-long-bbb';

function makeSdk(): { sdk: SaySdk; mock: MockAdapter } {
  const http = axios.create({ baseURL: 'http://api-say.test' });
  const mock = new MockAdapter(http);
  const sdk = new SaySdk({
    baseUrl: 'http://api-say.test',
    callerService: 'api-buy',
    serviceTokenSecret: SECRET,
    http,
  });
  return { sdk, mock };
}

describe('SayPendingApi', () => {
  it('list() returns parsed pending items + sends a service JWT scoped to userId', async () => {
    const { sdk, mock } = makeSdk();
    let capturedHeader: string | undefined;
    mock.onGet('/pending').reply((config) => {
      capturedHeader = config.headers?.['Authorization'] as string | undefined;
      const params = config.params as { destination: string };
      expect(params.destination).toBe('PENDING_BUY');
      return [
        200,
        [
          {
            dictationId: 'd1',
            createdAt: '2026-05-22T10:00:00Z',
            payload: { item: 'oat milk', quantity: 1 },
            transcript: 'pick up oat milk',
          },
        ],
      ];
    });
    const items = await sdk.pending.list({ userId: 'u1', destination: 'PENDING_BUY' });
    expect(items).toHaveLength(1);
    expect(items[0]?.payload).toEqual({ item: 'oat milk', quantity: 1 });
    expect(capturedHeader).toMatch(/^Bearer /);
    const payload = verifyServiceToken((capturedHeader ?? '').slice('Bearer '.length), {
      secret: SECRET,
      expectedAud: 'api-say',
    });
    expect(payload.iss).toBe('api-buy');
    expect(payload.sub).toBe('u1');
  });

  it('list() supports PENDING_SEND with an email payload', async () => {
    const { sdk, mock } = makeSdk();
    mock.onGet('/pending').reply((config) => {
      expect((config.params as { destination: string }).destination).toBe('PENDING_SEND');
      return [
        200,
        [
          {
            dictationId: 'd2',
            createdAt: '2026-06-21T10:00:00Z',
            payload: { subject: 'Hi', body: 'hello', recipientHint: 'Sarah' },
            transcript: 'email sarah hello',
          },
        ],
      ];
    });
    const items = await sdk.pending.list({ userId: 'u1', destination: 'PENDING_SEND' });
    expect(items[0]?.payload).toEqual({ subject: 'Hi', body: 'hello', recipientHint: 'Sarah' });
  });

  it('consume() POSTs destinationRef and authorizes with a service JWT', async () => {
    const { sdk, mock } = makeSdk();
    let capturedHeader: string | undefined;
    mock.onPost('/pending/d1/consume').reply((config) => {
      capturedHeader = config.headers?.['Authorization'] as string | undefined;
      const body = JSON.parse(config.data);
      expect(body.destinationRef).toBe('buy-item-42');
      return [200, { ok: true }];
    });
    const res = await sdk.pending.consume('d1', { userId: 'u1', destinationRef: 'buy-item-42' });
    expect(res.ok).toBe(true);
    expect(capturedHeader).toMatch(/^Bearer /);
    const payload = verifyServiceToken((capturedHeader ?? '').slice('Bearer '.length), {
      secret: SECRET,
      expectedAud: 'api-say',
    });
    expect(payload.sub).toBe('u1');
  });
});
