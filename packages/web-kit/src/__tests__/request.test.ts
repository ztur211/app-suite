import { apiRequest } from '../request';

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

describe('apiRequest', () => {
  it('resolves parsed JSON and sends credentials + JSON content-type', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ ok: true }));
    const result = await apiRequest<{ ok: boolean }>('http://x/y');
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://x/y');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(result).toEqual({ ok: true });
  });

  it('merges caller headers over the defaults', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}));
    await apiRequest('http://x/y', { headers: { 'Idempotency-Key': 'abc' } });
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('abc');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws "<status> <statusText>: <body>" on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ error: 'bad' }, 401));
    await expect(apiRequest('http://x/y')).rejects.toThrow('401 Error: {"error":"bad"}');
  });
});
