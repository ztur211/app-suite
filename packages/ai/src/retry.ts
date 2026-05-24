import { RetryExhaustedError, isTransientProviderError } from './errors';

export interface RetryOpts {
  /** Number of retries after the initial attempt. Default 2. */
  maxRetries?: number;
  /** First-retry delay in ms. Doubles each subsequent retry. Default 250. */
  baseDelayMs?: number;
  /** Injectable for tests; default is setTimeout-based. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 250;
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      // Only retry on transient provider errors.
      if (!isTransientProviderError(err)) throw err;
      lastError = err;
      if (attempt === maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  // lastError is guaranteed to be set because we only reach here after at
  // least one caught transient error (otherwise we'd have returned above).
  throw new RetryExhaustedError({
    attempts: maxRetries + 1,
    lastError: lastError as Error,
  });
}
