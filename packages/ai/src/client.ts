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
import {
  AiClient,
  type ChatOpts,
  type ImageInput,
  type Message,
  type Segment,
  type SummaryFormat,
  type TranscribeOpts,
  type Usage,
  type AiCallContext,
} from './types';
import type {
  AnthropicProvider,
  GoogleProvider,
  OpenAIProvider,
  OperationContext,
} from './providers/types';
import { buildProvidersFromKeys, type ProviderApiKeys } from './providers/build-from-keys';

export interface AiClientProviders {
  anthropic?: AnthropicProvider;
  openai?: OpenAIProvider;
  google?: GoogleProvider;
}

/** Common options shared between both `createAiClient` overloads. */
interface CommonAiClientOpts {
  routes?: RouteConfig;
  usageLogger?: UsageLogger;
  /** Default timeout per call in ms. Default 30000. */
  timeoutMs?: number;
  retry?: RetryOpts;
}

export interface CreateAiClientOpts extends CommonAiClientOpts {
  providers: AiClientProviders;
}

/** Sugar overload: pass raw API keys and the package builds providers internally. */
export interface CreateAiClientWithKeysOpts extends CommonAiClientOpts, ProviderApiKeys {}

interface RunOpts<T> {
  operation: AiOperation;
  route: RouteOptions;
  context: AiCallContext | undefined;
  /** Per-call timeout override. */
  timeoutMs: number;
  run: (entry: RouteEntry, opCtx: OperationContext) => Promise<{ value: T; usage: Usage }>;
}

class AiClientImpl extends AiClient {
  private readonly providers: AiClientProviders;
  private readonly routes: RouteConfig;
  private readonly usageLogger: UsageLogger;
  private readonly defaultTimeoutMs: number;
  private readonly retryOpts: RetryOpts;

  constructor(opts: CreateAiClientOpts) {
    super();
    this.providers = opts.providers;
    this.routes = opts.routes ?? defaultRouteConfig;
    this.usageLogger = opts.usageLogger ?? noopUsageLogger;
    this.defaultTimeoutMs = opts.timeoutMs ?? 30000;
    this.retryOpts = opts.retry ?? { maxRetries: 2, baseDelayMs: 250 };
  }

  private ensureProviderOperation(
    provider: ProviderId,
    opKey: string,
    operation: AiOperation,
  ): unknown {
    const p = this.providers[provider as keyof AiClientProviders];
    const fn = p ? (p as unknown as Record<string, unknown>)[opKey] : undefined;
    if (typeof fn !== 'function') {
      throw new RouteUnavailableError(operation);
    }
    return fn;
  }

  private async runWithRoute<T>(
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
      retryOpts: this.retryOpts,
      runner: async (entry) => o.run(entry, opCtxFor(entry)),
    });
    const durationMs = Date.now() - start;
    await this.usageLogger({
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

  async chat(messages: Message[], callOpts?: ChatOpts): Promise<{ text: string; usage: Usage }> {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? this.defaultTimeoutMs;
    const { value, usage } = await this.runWithRoute<string>({
      operation: 'chat',
      route: this.routes.chat,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = this.ensureProviderOperation(
          entry.provider,
          'chat',
          'chat',
        ) as AnthropicProvider['chat'];
        const r = await fn(messages, opts2, opCtx);
        return { value: r.text, usage: r.usage };
      },
    });
    return { text: value, usage };
  }

  async chatStructured<T>(
    schema: ZodSchema<T>,
    messages: Message[],
    callOpts?: ChatOpts,
  ): Promise<{ value: T; usage: Usage }> {
    const opts2 = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? this.defaultTimeoutMs;
    const { value, usage } = await this.runWithRoute<T>({
      operation: 'chatStructured',
      route: this.routes.chatStructured,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = this.ensureProviderOperation(
          entry.provider,
          'chatStructured',
          'chatStructured',
        ) as AnthropicProvider['chatStructured'];
        return fn(schema, messages, opts2, opCtx);
      },
    });
    return { value, usage };
  }

  async summarize(text: string, format: SummaryFormat): Promise<{ summary: string; usage: Usage }> {
    const { value, usage } = await this.runWithRoute<string>({
      operation: 'summarize',
      route: this.routes.summarize,
      context: undefined,
      timeoutMs: this.defaultTimeoutMs,
      run: async (entry, opCtx) => {
        const fn = this.ensureProviderOperation(
          entry.provider,
          'summarize',
          'summarize',
        ) as AnthropicProvider['summarize'];
        const r = await fn(text, format, opCtx);
        return { value: r.summary, usage: r.usage };
      },
    });
    return { summary: value, usage };
  }

  async transcribe(
    audio: Buffer,
    callOpts?: TranscribeOpts,
  ): Promise<{ text: string; segments: Segment[]; language: string; usage: Usage }> {
    const opts2: TranscribeOpts = callOpts ?? {};
    const timeoutMs = opts2.timeoutMs ?? this.defaultTimeoutMs;
    const { value, usage } = await this.runWithRoute<{
      text: string;
      segments: Segment[];
      language: string;
    }>({
      operation: 'transcribe',
      route: this.routes.transcribe,
      context: opts2.context,
      timeoutMs,
      run: async (entry, opCtx) => {
        const fn = this.ensureProviderOperation(
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
  }

  async embed(texts: string[]): Promise<{ vectors: number[][]; usage: Usage }> {
    const { value, usage } = await this.runWithRoute<number[][]>({
      operation: 'embed',
      route: this.routes.embed,
      context: undefined,
      timeoutMs: this.defaultTimeoutMs,
      run: async (entry, opCtx) => {
        const fn = this.ensureProviderOperation(
          entry.provider,
          'embed',
          'embed',
        ) as OpenAIProvider['embed'];
        const r = await fn(texts, opCtx);
        return { value: r.vectors, usage: r.usage };
      },
    });
    return { vectors: value, usage };
  }

  async vision(imageOrUrl: ImageInput, prompt: string): Promise<{ text: string; usage: Usage }> {
    const { value, usage } = await this.runWithRoute<string>({
      operation: 'vision',
      route: this.routes.vision,
      context: undefined,
      timeoutMs: this.defaultTimeoutMs,
      run: async (entry, opCtx) => {
        const fn = this.ensureProviderOperation(
          entry.provider,
          'vision',
          'vision',
        ) as GoogleProvider['vision'];
        const r = await fn(imageOrUrl, prompt, opCtx);
        return { value: r.text, usage: r.usage };
      },
    });
    return { text: value, usage };
  }
}

export function createAiClient(opts: CreateAiClientOpts): AiClient;
export function createAiClient(opts: CreateAiClientWithKeysOpts): AiClient;
export function createAiClient(opts: CreateAiClientOpts | CreateAiClientWithKeysOpts): AiClient {
  if ('providers' in opts) {
    return new AiClientImpl(opts);
  }
  const providers = buildProvidersFromKeys(opts);
  return new AiClientImpl({
    providers,
    routes: opts.routes,
    usageLogger: opts.usageLogger,
    timeoutMs: opts.timeoutMs,
    retry: opts.retry,
  });
}
