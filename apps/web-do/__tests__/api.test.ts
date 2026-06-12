import { tasksApi } from '../lib/api';

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

  it('update calls PATCH /tasks/:id with completed', async () => {
    const task = { id: 't3', title: 'task', completed: true };
    mockFetch.mockResolvedValueOnce(makeResponse(task));

    await tasksApi.update('t3', { completed: true });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks/t3');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ completed: true });
  });

  it('update calls PATCH /tasks/:id with title + dueAt', async () => {
    const task = { id: 't3', title: 'renamed', dueAt: '2026-06-01T00:00:00.000Z' };
    mockFetch.mockResolvedValueOnce(makeResponse(task));

    await tasksApi.update('t3', {
      title: 'renamed',
      dueAt: '2026-06-01T00:00:00.000Z',
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks/t3');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'renamed',
      dueAt: '2026-06-01T00:00:00.000Z',
    });
  });

  it('update calls PATCH /tasks/:id with dueAt: null to clear', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 't3' }));

    await tasksApi.update('t3', { dueAt: null });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ dueAt: null });
  });

  it('remove calls DELETE /tasks/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));

    await tasksApi.remove('t4');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/tasks/t4');
    expect(init.method).toBe('DELETE');
  });
});
