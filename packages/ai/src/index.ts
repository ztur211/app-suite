export { createAiClient } from './client';
export type { AiClientProviders, CreateAiClientOpts, CreateAiClientWithKeysOpts } from './client';

export { defaultRouteConfig, executeRoute } from './router';
export type { ProviderId, RouteConfig, RouteEntry, RouteOptions } from './router';

export { AiClient } from './types';
export type {
  AiCallContext,
  ChatOpts,
  ImageInput,
  Message,
  Segment,
  SummaryFormat,
  TranscribeOpts,
  Usage,
} from './types';

export {
  AiError,
  ProviderError,
  RetryExhaustedError,
  RouteUnavailableError,
  isTransientProviderError,
} from './errors';

export { noopUsageLogger } from './usage-logger';
export type { AiOperation, UsageLogEntry, UsageLogger } from './usage-logger';

export { retryWithBackoff } from './retry';
export type { RetryOpts } from './retry';

export { createAnthropicProvider } from './providers/anthropic';
export { createOpenAIProvider } from './providers/openai';
export { createGoogleProvider } from './providers/google';
export type {
  AnthropicProvider,
  ChatFn,
  ChatStructuredFn,
  EmbedFn,
  GoogleProvider,
  OpenAIProvider,
  OperationContext,
  SummarizeFn,
  TranscribeFn,
  VisionFn,
} from './providers/types';
