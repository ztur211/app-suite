import { dictationsApi } from '../lib/api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

// A minimal, inspectable FormData so assertions don't depend on whether the
// runtime's FormData is Node's (has .get) or React Native's (has .getParts).
class FakeFormData {
  parts: Array<[string, unknown]> = [];
  append(key: string, value: unknown): void {
    this.parts.push([key, value]);
  }
  get(key: string): unknown {
    return this.parts.find(([k]) => k === key)?.[1];
  }
}

const OriginalFormData = global.FormData;

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
  (global as unknown as { FormData: unknown }).FormData = FakeFormData;
});

afterEach(() => {
  (global as unknown as { FormData: unknown }).FormData = OriginalFormData;
});

describe('dictationsApi.createAudio', () => {
  const blob = { size: 1234, type: 'audio/webm' } as unknown as Blob;

  it('POSTs multipart to /dictations with the audio blob and tap captureMode', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ dictation: { id: 'd1' }, proposal: {} }));

    await dictationsApi.createAudio(blob, 'tap');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3003/dictations');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');

    const form = init.body as unknown as FakeFormData;
    expect(form).toBeInstanceOf(FakeFormData);
    expect(form.get('captureMode')).toBe('tap');
    expect(form.get('audio')).toBe(blob);
  });

  it('sends a non-empty Idempotency-Key header', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ dictation: { id: 'd1' }, proposal: {} }));
    await dictationsApi.createAudio(blob, 'tap');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const key = (init.headers as Record<string, string>)['Idempotency-Key'];
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('defaults captureMode to tap', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ dictation: { id: 'd1' }, proposal: {} }));
    await dictationsApi.createAudio(blob);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const form = init.body as unknown as FakeFormData;
    expect(form.get('captureMode')).toBe('tap');
  });

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ message: 'boom' }, 500));
    await expect(dictationsApi.createAudio(blob, 'tap')).rejects.toThrow('500');
  });
});
