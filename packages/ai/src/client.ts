import type { ZodSchema } from 'zod';
import { RouteUnavailableError } from './errors';
import {
  defaultRouteConfig,
  executeRoute,
  type ProviderId,
  type RouteConfig,
  type RouteEntry,
  type RouteOptions,
} from './router';
import type { RetryOpts } from './retry';
import { noopUsageLogger, type AiOperation, type UsageLogger } from './usage-logger';
import type {
  AiCallContext,
  AiClient,
  ChatOpts,
  ImageInput,
  Message,
  Segment,
  SummaryFormat,
  TranscribeOpts,
  Usage,
} from './types';
import type {
  AnthropicProvider,
  GoogleProvider,
  OpenAIProvider,
  OperationContext,
} from './providers/types';

export interface AiClientProviders {
  anthropic?: AnthropicProvider;
  openai?: OpenAIProvider;
  google?: GoogleProvider;
}

export interface CreateAiClientOpts {
  providers: AiClientProviders;
  routes?: RouteConfig;
  usageLogger?: UsageLogger;
  /** Default timeout per call in ms. Default 30000. */
  timeoutMs?: number;
  retry?: RetryOpts;
}

interface RunOpts<T> {
  operation: AiOperation;
  route: RouteOptions;
  context: AiCallContext | undefined;
  /** Per-call timeout override. */
  timeoutMs: number;
  run: (entry: RouteEntry, opCtx: OperationContext) => Promise<{ value: T; usage: Usage }>;
}

export function createAiClient(opts: CreateAiClientOpts): AiClient {
  const routes = opts.routes ?? defaultRouteConfig;
  const usageLogger = opts.usageLogger ?? noopUsageLogger;
  const defaultTimeoutMs = opts.timeoutMs ?? 30000;
  const retryOpts = opts.retry ?? { maxRetries: 2, baseDelayMs: 250 };

  function ensureProviderOperation(
    provider: ProviderId,
    opKey: string,
    operation: AiOperation,
  ): unknown {
    const p = opts.providers[provider as keyof AiClientProviders];
    const fn = p ? (p as unknown as Record<string, unknown>)[opKey] : undefined;
    if (typeof fn !== 'function') {
      throw new RouteUnavailableError(operation);
    }
    return fn;
  }

  async function runWithRoute<T>(
    o: RunOpts<T>,
  ): Promise<{ value: T; usage: Usage; usedEntry: RouteEntry; fellBackTo?: RouteEntry }> {
    const startedAt = new Date();
    const start = Date.now();
    const opCtxFor = (entry: RouteEntry): OperationContext => ({
      timeoutMs: o.timeoutMs,
      model: entry.model,
    });
    const result = await executeRoute({
      primary: o.route.primary,
      fallback: o.route.fallback,
      retryOpts,
      runner: async (entry) => o.run(entry, opCtxFor(entry)),
    });
    const durationMs = Date.now() - start;
    await usageLogger({
      operation: o.operation,
      provider: result.usedEntry.provider,
      model: result.usedEntry.model,
      usage: result.value.usage,
      userId: o.context?.userId,
      callerApp: o.context?.callerApp,
      startedAt,
      durationMs,
      fellBackTo: result.fellBackTo,
    });
    return {
      value: result.value.value,
      usage: result.value.usage,
      usedEntry: result.usedEntry,
      fellBackTo: result.fellBackTo,
    };
  }

  const chat: AiClient['chat'] = async (messages, callOpts) => {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? defaultTimeoutMs;
    const { value, usage } = await runWithRoute<string>({
      operation: 'chat',
      route: routes.chat,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'chat',
          'chat',
        ) as AnthropicProvider['chat'];
        const r = await fn(messages, opts2, opCtx);
        return { value: r.text, usage: r.usage };
      },
    });
    return { text: value, usage };
  };

  const chatStructured: AiClient['chatStructured'] = async <T>(
    schema: ZodSchema<T>,
    messages: Message[],
    callOpts?: ChatOpts,
  ) => {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? defaultTimeoutMs;
    const { value, usage } = await runWithRoute<T>({
      operation: 'chatStructured',
      route: routes.chatStructured,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'chatStructured',
          'chatStructured',
        ) as AnthropicProvider['chatStructured'];
        return fn(schema, messages, opts2, opCtx);
      },
    });
    return { value, usage };
  };

  const summarize: AiClient['summarize'] = async (text, format: SummaryFormat) => {
    const { value, usage } = await runWithRoute<string>({
      operation: 'summarize',
      route: routes.summarize,
      context: undefined,
      timeoutMs: defaultTimeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'summarize',
          'summarize',
        ) as AnthropicProvider['summarize'];
        const r = await fn(text, format, opCtx);
        return { value: r.summary, usage: r.usage };
      },
    });
    return { summary: value, usage };
  };

  const transcribe: AiClient['transcribe'] = async (audio, callOpts) => {
    const opts2: TranscribeOpts = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? defaultTimeoutMs;
    const { value, usage } = await runWithRoute<{
      text: string;
      segments: Segment[];
      language: string;
    }>({
      operation: 'transcribe',
      route: routes.transcribe,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'transcribe',
          'transcribe',
        ) as OpenAIProvider['transcribe'];
        const r = await fn(audio, opts2, opCtx);
        return {
          value: { text: r.text, segments: r.segments, language: r.language },
          usage: r.usage,
        };
      },
    });
    return {
      text: value.text,
      segments: value.segments,
      language: value.language,
      usage,
    };
  };

  const embed: AiClient['embed'] = async (texts) => {
    const { value, usage } = await runWithRoute<number[][]>({
      operation: 'embed',
      route: routes.embed,
      context: undefined,
      timeoutMs: defaultTimeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'embed',
          'embed',
        ) as OpenAIProvider['embed'];
        const r = await fn(texts, opCtx);
        return { value: r.vectors, usage: r.usage };
      },
    });
    return { vectors: value, usage };
  };

  const vision: AiClient['vision'] = async (imageOrUrl: ImageInput, prompt: string) => {
    const { value, usage } = await runWithRoute<string>({
      operation: 'vision',
      route: routes.vision,
      context: undefined,
      timeoutMs: defaultTimeoutMs,
      run: async (entry, opCtx) => {
        const fn = ensureProviderOperation(
          entry.provider,
          'vision',
          'vision',
        ) as GoogleProvider['vision'];
        const r = await fn(imageOrUrl, prompt, opCtx);
        return { value: r.text, usage: r.usage };
      },
    });
    return { text: value, usage };
  };

  return { chat, chatStructured, summarize, transcribe, embed, vision };
}
