import { authApi } from '../auth-api';

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

beforeEach(() => mockFetch.mockReset());

describe('authApi', () => {
  it('signUp POSTs email, password, derived name to /auth/sign-up/email', async () => {
    const user = { id: '1', email: 'a@b.com', name: 'a' };
    mockFetch.mockResolvedValueOnce(makeResponse({ user }));
    const result = await authApi.signUp('a@b.com', 'pass1234');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-up/email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.com',
      password: 'pass1234',
      name: 'a',
    });
    expect(result).toEqual({ user });
  });

  it('signIn POSTs to /auth/sign-in/email', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ user: { id: '2', email: 'b@c.com', name: 'b' } }),
    );
    await authApi.signIn('b@c.com', 'secret12');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-in/email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'b@c.com', password: 'secret12' });
  });

  it('signOut POSTs to /auth/sign-out', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(null));
    await authApi.signOut();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-out');
    expect(init.method).toBe('POST');
  });

  it('getSession GETs /auth/get-session', async () => {
    const session = { user: { id: '3', email: 'c@d.com', name: null } };
    mockFetch.mockResolvedValueOnce(makeResponse(session));
    const result = await authApi.getSession();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/get-session');
    expect(init.method).toBeUndefined();
    expect(result).toEqual(session);
  });

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'bad' }, 401));
    await expect(authApi.signIn('x@y.com', 'wrong123')).rejects.toThrow('401');
  });
});
