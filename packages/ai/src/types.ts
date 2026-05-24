import type { ZodSchema } from 'zod';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type Usage =
  | {
      kind: 'tokens';
      inputTokens: number;
      outputTokens: number;
      /** Anthropic prompt-caching only; absent when caching not used. */
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    }
  | {
      kind: 'audio';
      /** Total audio duration billed, in seconds. */
      seconds: number;
    }
  | {
      kind: 'embedding';
      inputTokens: number;
      vectorCount: number;
    };

export interface ChatOpts {
  /** Per-call override; otherwise router default. */
  model?: string;
  /** Enable Anthropic prompt caching of the system message. Default false. */
  cacheSystem?: boolean;
  /** Sampling temperature (0..1). Default per-provider. */
  temperature?: number;
  /** Hard cap on output tokens. Default 1024. */
  maxOutputTokens?: number;
  /** Per-call timeout override in ms. Default from client config. */
  timeoutMs?: number;
  /** Stop sequences forwarded to the provider where supported. */
  stop?: string[];
}

export interface TranscribeOpts {
  /** BCP-47 language tag (e.g. 'en'). Hints the transcriber. */
  language?: string;
  /** Domain-hint text fed to the model to bias the lexicon. */
  prompt?: string;
  /** Per-call timeout override in ms. */
  timeoutMs?: number;
}

export interface Segment {
  /** Start time within the audio, seconds. */
  start: number;
  /** End time within the audio, seconds. */
  end: number;
  text: string;
}

export type SummaryFormat = 'bullet' | 'paragraph' | 'tldr';

export type ImageInput = { url: string } | { data: Buffer; mimeType: string };

export interface AiClient {
  transcribe(
    audio: Buffer,
    opts?: TranscribeOpts,
  ): Promise<{
    text: string;
    segments: Segment[];
    language: string;
    usage: Usage;
  }>;

  chat(messages: Message[], opts?: ChatOpts): Promise<{ text: string; usage: Usage }>;

  chatStructured<T>(
    schema: ZodSchema<T>,
    messages: Message[],
    opts?: ChatOpts,
  ): Promise<{ value: T; usage: Usage }>;

  summarize(text: string, format: SummaryFormat): Promise<{ summary: string; usage: Usage }>;

  embed(texts: string[]): Promise<{ vectors: number[][]; usage: Usage }>;

  vision(imageOrUrl: ImageInput, prompt: string): Promise<{ text: string; usage: Usage }>;
}
