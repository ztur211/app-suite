import { z } from 'zod';
import { createAnthropicProvider } from '../../providers/anthropic';
import { ProviderError } from '../../errors';

interface FakeAnthropicClient {
  messages: {
    create: jest.Mock;
  };
}

function makeClient(): FakeAnthropicClient {
  return { messages: { create: jest.fn() } };
}

const ctx = { timeoutMs: 30000, model: 'claude-haiku-4-5-20251001' };

describe('createAnthropicProvider', () => {
  describe('chat', () => {
    it('sends system + user messages and returns text + token usage', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'hi back' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.chat(
        [
          { role: 'system', content: 'you are helpful' },
          { role: 'user', content: 'hi' },
        ],
        {},
        ctx,
      );
      expect(result.text).toBe('hi back');
      expect(result.usage).toEqual({
        kind: 'tokens',
        inputTokens: 10,
        outputTokens: 5,
      });
      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          system: 'you are helpful',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1024,
        }),
      );
    });

    it('opts.cacheSystem wraps the system message with cache_control', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: {
          input_tokens: 5,
          output_tokens: 2,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 50,
        },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.chat(
        [
          { role: 'system', content: 'long system prompt' },
          { role: 'user', content: 'q' },
        ],
        { cacheSystem: true },
        ctx,
      );
      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: [
            { type: 'text', text: 'long system prompt', cache_control: { type: 'ephemeral' } },
          ],
        }),
      );
      expect(result.usage).toEqual({
        kind: 'tokens',
        inputTokens: 5,
        outputTokens: 2,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
      });
    });

    it('passes temperature, maxOutputTokens, and stop sequences through', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      await provider.chat(
        [{ role: 'user', content: 'q' }],
        { temperature: 0.7, maxOutputTokens: 256, stop: ['END'] },
        ctx,
      );
      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 256,
          stop_sequences: ['END'],
        }),
      );
    });

    it('wraps SDK errors in ProviderError with status and provider id', async () => {
      const client = makeClient();
      const sdkErr = Object.assign(new Error('rate limited'), { status: 429 });
      client.messages.create.mockRejectedValueOnce(sdkErr);
      const provider = createAnthropicProvider(client as unknown as never);
      await expect(provider.chat([{ role: 'user', content: 'x' }], {}, ctx)).rejects.toMatchObject({
        provider: 'anthropic',
        status: 429,
      });
      await expect(provider.chat([{ role: 'user', content: 'x' }], {}, ctx)).rejects.toBeInstanceOf(
        ProviderError,
      );
    });
  });

  describe('summarize', () => {
    it('produces a summary using the requested format', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: '- bullet one\n- bullet two' }],
        usage: { input_tokens: 50, output_tokens: 8 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.summarize('long text body', 'bullet', ctx);
      expect(result.summary).toBe('- bullet one\n- bullet two');
      // Verify the system prompt mentions the format so the model knows what to do.
      const args = client.messages.create.mock.calls[0]?.[0] as {
        system: string;
      };
      expect(args.system).toMatch(/bullet/i);
    });
  });

  describe('chatStructured', () => {
    const schema = z.object({
      title: z.string(),
      priority: z.enum(['low', 'high']),
    });

    it('uses tool-use with a single tool whose input schema matches the Zod schema', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'respond',
            input: { title: 'buy milk', priority: 'high' },
          },
        ],
        usage: { input_tokens: 20, output_tokens: 10 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      const result = await provider.chatStructured(
        schema,
        [{ role: 'user', content: 'extract' }],
        {},
        ctx,
      );
      expect(result.value).toEqual({ title: 'buy milk', priority: 'high' });
      const args = client.messages.create.mock.calls[0]?.[0] as {
        tools: Array<{ name: string; input_schema: { type: string } }>;
        tool_choice: { type: string; name: string };
      };
      expect(args.tools).toHaveLength(1);
      expect(args.tools[0]?.name).toBe('respond');
      expect(args.tools[0]?.input_schema.type).toBe('object');
      expect(args.tool_choice).toEqual({ type: 'tool', name: 'respond' });
    });

    it('throws ProviderError if the model returns content of the wrong shape', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'sorry, not a tool call' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      await expect(
        provider.chatStructured(schema, [{ role: 'user', content: 'x' }], {}, ctx),
      ).rejects.toMatchObject({ provider: 'anthropic' });
    });

    it('throws ProviderError if the tool input fails Zod validation', async () => {
      const client = makeClient();
      client.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'respond',
            input: { title: 'buy milk', priority: 'bogus' },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
      const provider = createAnthropicProvider(client as unknown as never);
      await expect(
        provider.chatStructured(schema, [{ role: 'user', content: 'x' }], {}, ctx),
      ).rejects.toMatchObject({ provider: 'anthropic' });
    });
  });
});
