import { retryWithBackoff, type RetryOpts } from './retry';

export type ProviderId = 'anthropic' | 'openai' | 'google';

export interface RouteEntry {
  provider: ProviderId;
  model: string;
}

export interface RouteOptions {
  primary: RouteEntry;
  fallback?: RouteEntry;
}

export interface RouteConfig {
  chat: RouteOptions;
  chatStructured: RouteOptions;
  summarize: RouteOptions;
  transcribe: RouteOptions;
  embed: RouteOptions;
  vision: RouteOptions;
}

export const defaultRouteConfig: RouteConfig = {
  chat: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
  chatStructured: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
  summarize: {
    primary: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
  transcribe: {
    primary: { provider: 'openai', model: 'whisper-1' },
  },
  embed: {
    primary: { provider: 'openai', model: 'text-embedding-3-small' },
  },
  vision: {
    primary: { provider: 'google', model: 'gemini-2.5-flash' },
    fallback: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  },
};

export interface ExecuteRouteOpts<T> {
  primary: RouteEntry;
  fallback?: RouteEntry;
  /** Caller-provided function that invokes the appropriate provider op for the entry. */
  runner: (entry: RouteEntry) => Promise<T>;
  retryOpts: RetryOpts;
}

export interface ExecuteRouteResult<T> {
  value: T;
  usedEntry: RouteEntry;
  fellBackTo: RouteEntry | undefined;
}

/**
 * Runs the primary entry through retryWithBackoff. On terminal failure
 * (non-transient error or retry exhausted), runs the fallback entry the same
 * way. The runner is responsible for calling into the right provider/operation
 * given a route entry.
 */
export async function executeRoute<T>(opts: ExecuteRouteOpts<T>): Promise<ExecuteRouteResult<T>> {
  try {
    const value = await retryWithBackoff(() => opts.runner(opts.primary), opts.retryOpts);
    return { value, usedEntry: opts.primary, fellBackTo: undefined };
  } catch (primaryErr) {
    if (!opts.fallback) throw primaryErr;
    const fallback = opts.fallback;
    const value = await retryWithBackoff(() => opts.runner(fallback), opts.retryOpts);
    return {
      value,
      usedEntry: fallback,
      fellBackTo: fallback,
    };
  }
}
