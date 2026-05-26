import { authApi, messagesApi } from '../lib/api';

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

describe('authApi', () => {
  it('signIn calls POST /auth/sign-in/email', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ user: { id: '1', email: 'a@b.com', name: 'a' } }),
    );
    await authApi.signIn('a@b.com', 'password123');
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-in/email');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'bad' }, 401));
    await expect(authApi.signIn('x@y.com', 'wrongpass')).rejects.toThrow('401');
  });
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
});
