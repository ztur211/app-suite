export class AiError extends Error {
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = 'AiError';
    if (opts?.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

export interface ProviderErrorInit {
  provider: string;
  /** HTTP status if available; absent for network errors. */
  status?: number;
  message: string;
  cause?: unknown;
}

export class ProviderError extends AiError {
  readonly provider: string;
  readonly status: number | undefined;

  constructor(init: ProviderErrorInit) {
    const statusPart = init.status === undefined ? '' : ` [${init.status}]`;
    super(`${init.provider}${statusPart}: ${init.message}`, { cause: init.cause });
    this.name = 'ProviderError';
    this.provider = init.provider;
    this.status = init.status;
  }
}

export interface RetryExhaustedInit {
  attempts: number;
  lastError: Error;
}

export class RetryExhaustedError extends AiError {
  readonly attempts: number;
  readonly lastError: Error;

  constructor(init: RetryExhaustedInit) {
    super(`retry exhausted after ${init.attempts} attempts: ${init.lastError.message}`, {
      cause: init.lastError,
    });
    this.name = 'RetryExhaustedError';
    this.attempts = init.attempts;
    this.lastError = init.lastError;
  }
}

export class RouteUnavailableError extends AiError {
  readonly operation: string;

  constructor(operation: string) {
    super(`no provider route configured for operation "${operation}"`);
    this.name = 'RouteUnavailableError';
    this.operation = operation;
  }
}

export function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof ProviderError)) return false;
  // Network errors have no status — treat as transient.
  if (err.status === undefined) return true;
  // Rate limits and server errors are transient.
  if (err.status === 429) return true;
  if (err.status >= 500 && err.status < 600) return true;
  return false;
}
