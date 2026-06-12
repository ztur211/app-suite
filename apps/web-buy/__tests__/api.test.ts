import { itemsApi } from '../lib/api';

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

describe('itemsApi', () => {
  it('list calls GET /items', async () => {
    const items = [{ id: 'i1', title: 'milk', status: 'active' }];
    mockFetch.mockResolvedValueOnce(makeResponse(items));
    await itemsApi.list();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3004/items');
    expect(init.method).toBeUndefined();
  });

  it('create calls POST /items with title', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'i2' }));
    await itemsApi.create({ title: 'eggs', quantity: 12 });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3004/items');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ title: 'eggs', quantity: 12 });
  });

  it('update calls PATCH /items/:id with partial', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ id: 'i3' }));
    await itemsApi.update('i3', { status: 'bought' });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3004/items/i3');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'bought' });
  });

  it('remove calls DELETE /items/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));
    await itemsApi.remove('i4');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3004/items/i4');
    expect(init.method).toBe('DELETE');
  });

  it('sync calls POST /sync and returns summary', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ created: 2, consumed: 3 }));
    const summary = await itemsApi.sync();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3004/sync');
    expect(init.method).toBe('POST');
    expect(summary).toEqual({ created: 2, consumed: 3 });
  });
});
