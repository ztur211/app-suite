import { messagesApi } from '../lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('messagesApi', () => {
  it('list calls GET /messages', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]));
    await messagesApi.list();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/messages');
  });

  it('create calls POST /messages with channel + body', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'm1' }));
    await messagesApi.create({ channel: 'email', body: 'hi' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/messages');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ channel: 'email', body: 'hi' });
  });

  it('update calls PATCH /messages/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'm1' }));
    await messagesApi.update('m1', { status: 'sent' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/messages/m1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'sent' });
  });

  it('remove calls DELETE /messages/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));
    await messagesApi.remove('m1');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(url).toBe('http://localhost:3006/messages/m1');
  });

  it('send calls POST /messages/:id/send', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'm1', status: 'sent' }));
    await messagesApi.send('m1');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/messages/m1/send');
    expect(init.method).toBe('POST');
  });

  it('sync calls POST /messages/sync', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ inboundCreated: 1, processed: 1 }));
    const r = await messagesApi.sync();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/messages/sync');
    expect(init.method).toBe('POST');
    expect(r).toEqual({ inboundCreated: 1, processed: 1 });
  });

  it('linkTelegram calls POST /telegram/link with chatId', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true, chatId: '99' }));
    await messagesApi.linkTelegram('99');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/telegram/link');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ chatId: '99' });
  });

  it('syncFromSay calls POST /sync', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ created: 1, consumed: 1 }));
    const r = await messagesApi.syncFromSay();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3006/sync');
    expect(init.method).toBe('POST');
    expect(r).toEqual({ created: 1, consumed: 1 });
  });
});
