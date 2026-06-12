import { mealsApi } from '../lib/api';

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

describe('mealsApi', () => {
  it('list calls GET /meals', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]));
    await mealsApi.list();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3005/meals');
  });

  it('create calls POST /meals with name + kind', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'm1' }));
    await mealsApi.create({ name: 'Tacos', kind: 'recipe' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3005/meals');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Tacos', kind: 'recipe' });
  });

  it('update calls PATCH /meals/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'm1' }));
    await mealsApi.update('m1', { status: 'tried' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3005/meals/m1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'tried' });
  });

  it('remove calls DELETE /meals/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));
    await mealsApi.remove('m1');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('DELETE');
    expect(url).toBe('http://localhost:3005/meals/m1');
  });

  it('sync calls POST /sync', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ created: 1, consumed: 1 }));
    const result = await mealsApi.sync();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3005/sync');
    expect(init.method).toBe('POST');
    expect(result).toEqual({ created: 1, consumed: 1 });
  });
});
