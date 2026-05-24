import type {
  Message,
  ChatOpts,
  TranscribeOpts,
  Segment,
  Usage,
  SummaryFormat,
  ImageInput,
  AiClient,
} from '../types';

describe('@things/ai public types', () => {
  it('Message accepts the three roles', () => {
    const messages: Message[] = [
      { role: 'system', content: 'you are helpful' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];
    expect(messages).toHaveLength(3);
  });

  it('Usage is a discriminated union over tokens / audio / embedding', () => {
    const tokens: Usage = {
      kind: 'tokens',
      inputTokens: 10,
      outputTokens: 20,
    };
    const audio: Usage = { kind: 'audio', seconds: 12.5 };
    const embedding: Usage = {
      kind: 'embedding',
      inputTokens: 100,
      vectorCount: 4,
    };
    expect(tokens.kind).toBe('tokens');
    expect(audio.kind).toBe('audio');
    expect(embedding.kind).toBe('embedding');
  });

  it('ChatOpts accepts cacheSystem and maxOutputTokens', () => {
    const opts: ChatOpts = {
      cacheSystem: true,
      maxOutputTokens: 1024,
      temperature: 0.2,
    };
    expect(opts.cacheSystem).toBe(true);
  });

  it('TranscribeOpts accepts language and prompt', () => {
    const opts: TranscribeOpts = { language: 'en', prompt: 'meeting notes' };
    expect(opts.language).toBe('en');
  });

  it('Segment shape is { start, end, text }', () => {
    const seg: Segment = { start: 0, end: 1.2, text: 'hello' };
    expect(seg.text).toBe('hello');
  });

  it('SummaryFormat enumerates the allowed labels', () => {
    const formats: SummaryFormat[] = ['bullet', 'paragraph', 'tldr'];
    expect(formats).toHaveLength(3);
  });

  it('ImageInput accepts a url string or { data, mimeType }', () => {
    const url: ImageInput = { url: 'https://example.com/cat.png' };
    const data: ImageInput = {
      data: Buffer.from(''),
      mimeType: 'image/png',
    };
    expect('url' in url).toBe(true);
    expect('data' in data).toBe(true);
  });

  it('AiClient is the shape used by consumers', () => {
    // Type-level assertion: an object literal of the right shape should assign.
    const _stub: AiClient = {
      transcribe: async () => ({
        text: '',
        segments: [],
        language: 'en',
        usage: { kind: 'audio', seconds: 0 },
      }),
      chat: async () => ({
        text: '',
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
      chatStructured: async <T>() => ({
        value: undefined as unknown as T,
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
      summarize: async () => ({
        summary: '',
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
      embed: async () => ({
        vectors: [],
        usage: { kind: 'embedding', inputTokens: 0, vectorCount: 0 },
      }),
      vision: async () => ({
        text: '',
        usage: { kind: 'tokens', inputTokens: 0, outputTokens: 0 },
      }),
    };
    expect(typeof _stub.chat).toBe('function');
  });
});
