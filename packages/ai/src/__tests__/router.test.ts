import { defaultRouteConfig, executeRoute } from '../router';
import { ProviderError } from '../errors';

describe('defaultRouteConfig', () => {
  it('defines every operation with at least a primary', () => {
    const ops: Array<keyof typeof defaultRouteConfig> = [
      'chat',
      'chatStructured',
      'summarize',
      'transcribe',
      'embed',
      'vision',
    ];
    for (const op of ops) {
      const entry = defaultRouteConfig[op];
      expect(entry.primary.provider).toBeDefined();
      expect(entry.primary.model).toBeTruthy();
    }
  });

  it('routes chat/summarize/chatStructured to Anthropic Haiku with Sonnet fallback', () => {
    expect(defaultRouteConfig.chat.primary).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
    expect(defaultRouteConfig.chat.fallback).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
    expect(defaultRouteConfig.summarize.primary.model).toBe('claude-haiku-4-5-20251001');
    expect(defaultRouteConfig.chatStructured.primary.model).toBe('claude-haiku-4-5-20251001');
  });

  it('routes transcribe to OpenAI Whisper and embed to text-embedding-3-small', () => {
    expect(defaultRouteConfig.transcribe.primary).toEqual({
      provider: 'openai',
      model: 'whisper-1',
    });
    expect(defaultRouteConfig.transcribe.fallback).toBeUndefined();
    expect(defaultRouteConfig.embed.primary).toEqual({
      provider: 'openai',
      model: 'text-embedding-3-small',
    });
  });

  it('routes vision to Gemini with Anthropic Sonnet fallback', () => {
    expect(defaultRouteConfig.vision.primary).toEqual({
      provider: 'google',
      model: 'gemini-2.5-flash',
    });
    expect(defaultRouteConfig.vision.fallback).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });
});

describe('executeRoute', () => {
  const primaryEntry = {
    provider: 'anthropic' as const,
    model: 'claude-haiku-4-5-20251001',
  };
  const fallbackEntry = {
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-6',
  };

  it('returns the primary result when primary succeeds', async () => {
    const runner = jest.fn().mockResolvedValueOnce('primary-ok');
    const result = await executeRoute({
      primary: primaryEntry,
      fallback: fallbackEntry,
      runner,
      retryOpts: { maxRetries: 0, baseDelayMs: 1 },
    });
    expect(result.value).toBe('primary-ok');
    expect(result.usedEntry).toEqual(primaryEntry);
    expect(result.fellBackTo).toBeUndefined();
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(primaryEntry);
  });

  it('falls back to fallback entry when primary fails terminally', async () => {
    const nonTransient = new ProviderError({
      provider: 'anthropic',
      status: 400,
      message: 'context too long',
    });
    const runner = jest
      .fn()
      .mockRejectedValueOnce(nonTransient)
      .mockResolvedValueOnce('fallback-ok');
    const result = await executeRoute({
      primary: primaryEntry,
      fallback: fallbackEntry,
      runner,
      retryOpts: { maxRetries: 0, baseDelayMs: 1 },
    });
    expect(result.value).toBe('fallback-ok');
    expect(result.usedEntry).toEqual(fallbackEntry);
    expect(result.fellBackTo).toEqual(fallbackEntry);
    expect(runner).toHaveBeenNthCalledWith(1, primaryEntry);
    expect(runner).toHaveBeenNthCalledWith(2, fallbackEntry);
  });

  it('falls back on RetryExhaustedError after primary retry exhaustion', async () => {
    const transient = new ProviderError({
      provider: 'anthropic',
      status: 503,
      message: 'unavail',
    });
    const runner = jest
      .fn()
      // Primary: 3 transient failures → retry exhausted
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      // Fallback succeeds
      .mockResolvedValueOnce('fallback-ok');
    const result = await executeRoute({
      primary: primaryEntry,
      fallback: fallbackEntry,
      runner,
      retryOpts: { maxRetries: 2, baseDelayMs: 1, sleep: async () => undefined },
    });
    expect(result.value).toBe('fallback-ok');
    expect(result.fellBackTo).toEqual(fallbackEntry);
    expect(runner).toHaveBeenCalledTimes(4);
  });

  it('rethrows when primary fails terminally and there is no fallback', async () => {
    const nonTransient = new ProviderError({
      provider: 'openai',
      status: 401,
      message: 'bad key',
    });
    const runner = jest.fn().mockRejectedValueOnce(nonTransient);
    await expect(
      executeRoute({
        primary: primaryEntry,
        runner,
        retryOpts: { maxRetries: 0, baseDelayMs: 1 },
      }),
    ).rejects.toBe(nonTransient);
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('rethrows when fallback also fails', async () => {
    const primaryErr = new ProviderError({
      provider: 'anthropic',
      status: 400,
      message: 'primary failed',
    });
    const fallbackErr = new ProviderError({
      provider: 'anthropic',
      status: 400,
      message: 'fallback failed too',
    });
    const runner = jest.fn().mockRejectedValueOnce(primaryErr).mockRejectedValueOnce(fallbackErr);
    await expect(
      executeRoute({
        primary: primaryEntry,
        fallback: fallbackEntry,
        runner,
        retryOpts: { maxRetries: 0, baseDelayMs: 1 },
      }),
    ).rejects.toBe(fallbackErr);
  });
});
