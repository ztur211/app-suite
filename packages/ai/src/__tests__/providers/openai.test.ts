import { createOpenAIProvider } from '../../providers/openai';
import { ProviderError } from '../../errors';

interface FakeOpenAIClient {
  audio: {
    transcriptions: {
      create: jest.Mock;
    };
  };
  embeddings: {
    create: jest.Mock;
  };
}

function makeClient(): FakeOpenAIClient {
  return {
    audio: { transcriptions: { create: jest.fn() } },
    embeddings: { create: jest.fn() },
  };
}

const transcribeCtx = { timeoutMs: 60000, model: 'whisper-1' };
const embedCtx = { timeoutMs: 30000, model: 'text-embedding-3-small' };

describe('createOpenAIProvider', () => {
  describe('transcribe', () => {
    it('returns text, segments, language, and audio usage', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'hello world',
        language: 'english',
        duration: 12.5,
        segments: [
          { start: 0, end: 1.2, text: 'hello' },
          { start: 1.2, end: 2.5, text: 'world' },
        ],
      });
      const provider = createOpenAIProvider(client as unknown as never);
      const result = await provider.transcribe(
        Buffer.from('fake-audio-bytes'),
        { language: 'en' },
        transcribeCtx,
      );
      expect(result.text).toBe('hello world');
      expect(result.language).toBe('english');
      expect(result.segments).toEqual([
        { start: 0, end: 1.2, text: 'hello' },
        { start: 1.2, end: 2.5, text: 'world' },
      ]);
      expect(result.usage).toEqual({ kind: 'audio', seconds: 12.5 });
    });

    it('requests verbose_json so segments come back', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockResolvedValueOnce({
        text: '',
        language: 'en',
        duration: 0,
        segments: [],
      });
      const provider = createOpenAIProvider(client as unknown as never);
      await provider.transcribe(Buffer.from('x'), {}, transcribeCtx);
      const args = client.audio.transcriptions.create.mock.calls[0]?.[0] as {
        model: string;
        response_format: string;
      };
      expect(args.model).toBe('whisper-1');
      expect(args.response_format).toBe('verbose_json');
    });

    it('passes language and prompt hints when provided', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockResolvedValueOnce({
        text: '',
        language: 'en',
        duration: 0,
        segments: [],
      });
      const provider = createOpenAIProvider(client as unknown as never);
      await provider.transcribe(
        Buffer.from('x'),
        { language: 'es', prompt: 'medical terms' },
        transcribeCtx,
      );
      const args = client.audio.transcriptions.create.mock.calls[0]?.[0] as {
        language: string;
        prompt: string;
      };
      expect(args.language).toBe('es');
      expect(args.prompt).toBe('medical terms');
    });

    it('wraps SDK errors in ProviderError', async () => {
      const client = makeClient();
      client.audio.transcriptions.create.mockRejectedValueOnce(
        Object.assign(new Error('bad'), { status: 500 }),
      );
      const provider = createOpenAIProvider(client as unknown as never);
      await expect(provider.transcribe(Buffer.from('x'), {}, transcribeCtx)).rejects.toBeInstanceOf(
        ProviderError,
      );
    });
  });

  describe('embed', () => {
    it('returns one vector per input + token usage', async () => {
      const client = makeClient();
      client.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
        usage: { prompt_tokens: 7 },
      });
      const provider = createOpenAIProvider(client as unknown as never);
      const result = await provider.embed(['hello', 'world'], embedCtx);
      expect(result.vectors).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);
      expect(result.usage).toEqual({
        kind: 'embedding',
        inputTokens: 7,
        vectorCount: 2,
      });
    });

    it('sends the model and the inputs', async () => {
      const client = makeClient();
      client.embeddings.create.mockResolvedValueOnce({
        data: [{ embedding: [0] }],
        usage: { prompt_tokens: 1 },
      });
      const provider = createOpenAIProvider(client as unknown as never);
      await provider.embed(['a'], embedCtx);
      expect(client.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['a'],
      });
    });

    it('wraps SDK errors in ProviderError', async () => {
      const client = makeClient();
      client.embeddings.create.mockRejectedValueOnce(
        Object.assign(new Error('oops'), { status: 401 }),
      );
      const provider = createOpenAIProvider(client as unknown as never);
      await expect(provider.embed(['x'], embedCtx)).rejects.toMatchObject({
        provider: 'openai',
        status: 401,
      });
    });
  });
});
