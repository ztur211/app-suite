import type { ZodSchema } from 'zod';
import type {
  ChatOpts,
  ImageInput,
  Message,
  Segment,
  SummaryFormat,
  TranscribeOpts,
  Usage,
} from '../types';

export interface OperationContext {
  /** Per-call timeout from client config; provider may pass to its SDK. */
  timeoutMs: number;
  /** The model id this operation should run on (selected by the router). */
  model: string;
}

export type ChatFn = (
  messages: Message[],
  opts: ChatOpts,
  ctx: OperationContext,
) => Promise<{ text: string; usage: Usage }>;

export type ChatStructuredFn = <T>(
  schema: ZodSchema<T>,
  messages: Message[],
  opts: ChatOpts,
  ctx: OperationContext,
) => Promise<{ value: T; usage: Usage }>;

export type SummarizeFn = (
  text: string,
  format: SummaryFormat,
  ctx: OperationContext,
) => Promise<{ summary: string; usage: Usage }>;

export type TranscribeFn = (
  audio: Buffer,
  opts: TranscribeOpts,
  ctx: OperationContext,
) => Promise<{
  text: string;
  segments: Segment[];
  language: string;
  usage: Usage;
}>;

export type EmbedFn = (
  texts: string[],
  ctx: OperationContext,
) => Promise<{ vectors: number[][]; usage: Usage }>;

export type VisionFn = (
  imageOrUrl: ImageInput,
  prompt: string,
  ctx: OperationContext,
) => Promise<{ text: string; usage: Usage }>;

export interface AnthropicProvider {
  chat: ChatFn;
  chatStructured: ChatStructuredFn;
  summarize: SummarizeFn;
}

export interface OpenAIProvider {
  transcribe: TranscribeFn;
  embed: EmbedFn;
}

export interface GoogleProvider {
  vision: VisionFn;
}
