import { authApi, tasksApi } from '../lib/api';

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
  it('signUp calls POST /auth/sign-up/email with email, password, name', async () => {
    const user = { id: '1', email: 'a@b.com', name: 'a' };
    mockFetch.mockResolvedValueOnce(makeResponse({ user }));

    const result = await authApi.signUp('a@b.com', 'pass123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-up/email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'a@b.com',
      password: 'pass123',
      name: 'a',
    });
    expect(init.credentials).toBe('include');
    expect(result).toEqual({ user });
  });

  it('signIn calls POST /auth/sign-in/email', async () => {
    const user = { id: '2', email: 'b@c.com', name: 'b' };
    mockFetch.mockResolvedValueOnce(makeResponse({ user }));

    await authApi.signIn('b@c.com', 'secret');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-in/email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'b@c.com', password: 'secret' });
  });

  it('signOut calls POST /auth/sign-out', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(null));

    await authApi.signOut();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/sign-out');
    expect(init.method).toBe('POST');
  });

  it('getSession calls GET /auth/get-session', async () => {
    const session = { user: { id: '3', email: 'c@d.com', name: null } };
    mockFetch.mockResolvedValueOnce(makeResponse(session));

    const result = await authApi.getSession();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/auth/get-session');
    expect(init.method).toBeUndefined();
    expect(result).toEqual(session);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'bad' }, 401));

    await expect(authApi.signIn('x@y.com', 'wrong')).rejects.toThrow('401');
  });
});

describe('tasksApi', () => {
  it('list calls GET /tasks', async () => {
    const tasks = [{ id: 't1', title: 'test', completed: false }];
    mockFetch.mockResolvedValueOnce(makeResponse(tasks));

    const result = await tasksApi.list();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks');
    expect(init.method).toBeUndefined();
    expect(result).toEqual(tasks);
  });

  it('create calls POST /tasks with title', async () => {
    const task = { id: 't2', title: 'new task', completed: false };
    mockFetch.mockResolvedValueOnce(makeResponse(task));

    await tasksApi.create('new task');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ title: 'new task' });
  });

  it('setCompleted calls PATCH /tasks/:id', async () => {
    const task = { id: 't3', title: 'task', completed: true };
    mockFetch.mockResolvedValueOnce(makeResponse(task));

    await tasksApi.setCompleted('t3', true);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks/t3');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ completed: true });
  });

  it('remove calls DELETE /tasks/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));

    await tasksApi.remove('t4');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks/t4');
    expect(init.method).toBe('DELETE');
  });
});
