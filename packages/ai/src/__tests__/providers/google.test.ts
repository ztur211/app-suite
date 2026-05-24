import { createGoogleProvider } from '../../providers/google';
import { ProviderError } from '../../errors';

interface FakeGenerativeModel {
  generateContent: jest.Mock;
}

interface FakeGoogleClient {
  getGenerativeModel: jest.Mock<FakeGenerativeModel, [{ model: string }]>;
}

function makeClient(): { client: FakeGoogleClient; model: FakeGenerativeModel } {
  const model: FakeGenerativeModel = { generateContent: jest.fn() };
  const client: FakeGoogleClient = {
    getGenerativeModel: jest.fn().mockReturnValue(model),
  };
  return { client, model };
}

const ctx = { timeoutMs: 30000, model: 'gemini-2.5-flash' };

describe('createGoogleProvider', () => {
  it('describes an image from a URL (fetches and inlines as base64)', async () => {
    const { client, model } = makeClient();
    model.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'a fluffy cat',
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 5 },
      },
    });
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      headers: new Headers({ 'content-type': 'image/png' }),
    });
    const provider = createGoogleProvider(client as unknown as never, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.vision(
      { url: 'https://example.com/cat.png' },
      'what is this',
      ctx,
    );
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/cat.png');
    expect(client.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
    });
    expect(result.text).toBe('a fluffy cat');
    expect(result.usage).toEqual({
      kind: 'tokens',
      inputTokens: 50,
      outputTokens: 5,
    });
    const args = model.generateContent.mock.calls[0]?.[0] as Array<unknown>;
    // First arg: prompt; second arg: inlineData
    expect(args[0]).toBe('what is this');
    expect(args[1]).toMatchObject({
      inlineData: {
        mimeType: 'image/png',
        // base64 of [1,2,3,4]
        data: Buffer.from([1, 2, 3, 4]).toString('base64'),
      },
    });
  });

  it('describes an image from raw bytes', async () => {
    const { client, model } = makeClient();
    model.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'description',
        usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 2 },
      },
    });
    const fetchMock = jest.fn();
    const provider = createGoogleProvider(client as unknown as never, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.vision(
      { data: Buffer.from([9, 9]), mimeType: 'image/jpeg' },
      'caption it',
      ctx,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.text).toBe('description');
    const args = model.generateContent.mock.calls[0]?.[0] as Array<unknown>;
    expect(args[1]).toMatchObject({
      inlineData: {
        mimeType: 'image/jpeg',
        data: Buffer.from([9, 9]).toString('base64'),
      },
    });
  });

  it('wraps SDK errors in ProviderError', async () => {
    const { client, model } = makeClient();
    model.generateContent.mockRejectedValueOnce(Object.assign(new Error('quota'), { status: 429 }));
    const provider = createGoogleProvider(client as unknown as never);
    await expect(
      provider.vision({ data: Buffer.from([0]), mimeType: 'image/png' }, 'q', ctx),
    ).rejects.toMatchObject({ provider: 'google', status: 429 });
  });

  it('throws ProviderError when image URL fetch fails', async () => {
    const { client } = makeClient();
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'not found',
    });
    const provider = createGoogleProvider(client as unknown as never, {
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(
      provider.vision({ url: 'https://example.com/x.png' }, 'q', ctx),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
