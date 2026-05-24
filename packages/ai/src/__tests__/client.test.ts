import { z } from 'zod';
import { createAiClient } from '../client';
import type { ProviderId, RouteConfig } from '../router';
import { defaultRouteConfig } from '../router';
import { ProviderError, RouteUnavailableError } from '../errors';
import type { UsageLogEntry } from '../usage-logger';

function tokenUsage(input = 1, output = 1) {
  return { kind: 'tokens' as const, inputTokens: input, outputTokens: output };
}

function makeStubProviders() {
  return {
    anthropic: {
      chat: jest.fn().mockResolvedValue({ text: 'hi', usage: tokenUsage(2, 3) }),
      chatStructured: jest.fn().mockResolvedValue({ value: { ok: true }, usage: tokenUsage(4, 5) }),
      summarize: jest.fn().mockResolvedValue({ summary: 'sum', usage: tokenUsage(6, 7) }),
    },
    openai: {
      transcribe: jest.fn().mockResolvedValue({
        text: 'hello',
        segments: [],
        language: 'en',
        usage: { kind: 'audio' as const, seconds: 10 },
      }),
      embed: jest.fn().mockResolvedValue({
        vectors: [[0]],
        usage: { kind: 'embedding' as const, inputTokens: 1, vectorCount: 1 },
      }),
    },
    google: {
      vision: jest.fn().mockResolvedValue({ text: 'cat', usage: tokenUsage(8, 9) }),
    },
  };
}

describe('createAiClient', () => {
  it('routes chat() through Anthropic primary and logs usage', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.chat([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('hi');
    expect(providers.anthropic.chat).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      usage: tokenUsage(2, 3),
    });
    expect(calls[0]?.fellBackTo).toBeUndefined();
    expect(calls[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back to Sonnet when Haiku fails and records fellBackTo in usage log', async () => {
    const providers = makeStubProviders();
    providers.anthropic.chat
      .mockReset()
      .mockRejectedValueOnce(
        new ProviderError({ provider: 'anthropic', status: 400, message: 'too long' }),
      )
      .mockResolvedValueOnce({ text: 'sonnet-result', usage: tokenUsage(10, 20) });
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.chat([{ role: 'user', content: 'x' }]);
    expect(result.text).toBe('sonnet-result');
    expect(providers.anthropic.chat).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      operation: 'chat',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      fellBackTo: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    });
  });

  it('routes transcribe() through OpenAI and logs audio usage', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.transcribe(Buffer.from('audio'));
    expect(result.text).toBe('hello');
    expect(providers.openai.transcribe).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      operation: 'transcribe',
      provider: 'openai',
      model: 'whisper-1',
      usage: { kind: 'audio', seconds: 10 },
    });
  });

  it('routes chatStructured() through Anthropic with the schema', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const schema = z.object({ ok: z.boolean() });
    const result = await client.chatStructured(schema, [{ role: 'user', content: 'q' }]);
    expect(result.value).toEqual({ ok: true });
    expect(providers.anthropic.chatStructured).toHaveBeenCalledTimes(1);
    expect(calls[0]?.operation).toBe('chatStructured');
  });

  it('routes summarize() through Anthropic', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.summarize('long text', 'bullet');
    expect(result.summary).toBe('sum');
    expect(providers.anthropic.summarize).toHaveBeenCalledWith(
      'long text',
      'bullet',
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    );
    expect(calls[0]?.operation).toBe('summarize');
  });

  it('routes embed() through OpenAI', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.embed(['hello']);
    expect(result.vectors).toEqual([[0]]);
    expect(providers.openai.embed).toHaveBeenCalledTimes(1);
    expect(calls[0]?.operation).toBe('embed');
  });

  it('routes vision() through Google with Anthropic fallback', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    const result = await client.vision(
      { data: Buffer.from([1]), mimeType: 'image/png' },
      'describe',
    );
    expect(result.text).toBe('cat');
    expect(providers.google.vision).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({
      operation: 'vision',
      provider: 'google',
      model: 'gemini-2.5-flash',
    });
  });

  it('throws RouteUnavailableError when the configured provider is missing', async () => {
    const partialProviders = { openai: makeStubProviders().openai } as never;
    const client = createAiClient({
      providers: partialProviders,
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      RouteUnavailableError,
    );
  });

  it('does NOT log usage when the call fails terminally', async () => {
    const providers = makeStubProviders();
    providers.anthropic.chat
      .mockReset()
      .mockRejectedValueOnce(
        new ProviderError({ provider: 'anthropic', status: 400, message: 'p' }),
      )
      .mockRejectedValueOnce(
        new ProviderError({ provider: 'anthropic', status: 400, message: 'f' }),
      );
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await expect(client.chat([{ role: 'user', content: 'x' }])).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(calls).toHaveLength(0);
  });

  it('uses custom routes when provided', async () => {
    const providers = makeStubProviders();
    const customRoutes: RouteConfig = {
      ...defaultRouteConfig,
      chat: {
        primary: { provider: 'anthropic' as ProviderId, model: 'claude-opus-4-7' },
      },
    };
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      routes: customRoutes,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await client.chat([{ role: 'user', content: 'x' }]);
    expect(providers.anthropic.chat).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ model: 'claude-opus-4-7' }),
    );
    expect(calls[0]?.model).toBe('claude-opus-4-7');
  });

  it('attaches userId and callerApp from per-call context to the usage log', async () => {
    const providers = makeStubProviders();
    const calls: UsageLogEntry[] = [];
    const client = createAiClient({
      providers: providers as never,
      usageLogger: async (e) => {
        calls.push(e);
      },
      retry: { maxRetries: 0, baseDelayMs: 1 },
    });
    await client.chat([{ role: 'user', content: 'x' }], {
      context: { userId: 'u_42', callerApp: 'api-say' },
    } as never);
    expect(calls[0]?.userId).toBe('u_42');
    expect(calls[0]?.callerApp).toBe('api-say');
  });
});
