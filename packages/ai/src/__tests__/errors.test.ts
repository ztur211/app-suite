import {
  AiError,
  ProviderError,
  RetryExhaustedError,
  RouteUnavailableError,
  isTransientProviderError,
} from '../errors';

describe('AI errors', () => {
  it('AiError sets name to AiError', () => {
    const e = new AiError('boom');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('AiError');
    expect(e.message).toBe('boom');
  });

  it('ProviderError carries provider id, status, and cause', () => {
    const cause = new Error('network down');
    const e = new ProviderError({
      provider: 'anthropic',
      status: 429,
      message: 'rate limited',
      cause,
    });
    expect(e).toBeInstanceOf(AiError);
    expect(e.provider).toBe('anthropic');
    expect(e.status).toBe(429);
    expect(e.cause).toBe(cause);
    expect(e.message).toContain('anthropic');
    expect(e.message).toContain('429');
  });

  it('RetryExhaustedError records the attempt count and last error', () => {
    const last = new ProviderError({
      provider: 'openai',
      status: 503,
      message: 'unavailable',
    });
    const e = new RetryExhaustedError({ attempts: 3, lastError: last });
    expect(e).toBeInstanceOf(AiError);
    expect(e.attempts).toBe(3);
    expect(e.lastError).toBe(last);
  });

  it('RouteUnavailableError carries the operation name', () => {
    const e = new RouteUnavailableError('transcribe');
    expect(e).toBeInstanceOf(AiError);
    expect(e.operation).toBe('transcribe');
    expect(e.message).toContain('transcribe');
  });

  it('isTransientProviderError flags 408, 425, 429, and 5xx as transient', () => {
    const statuses = [408, 425, 429, 500, 502, 503, 504];
    for (const status of statuses) {
      const e = new ProviderError({ provider: 'anthropic', status, message: 'x' });
      expect(isTransientProviderError(e)).toBe(true);
    }
  });

  it('isTransientProviderError flags 400/401/403/404 as non-transient', () => {
    for (const status of [400, 401, 403, 404]) {
      const e = new ProviderError({ provider: 'openai', status, message: 'x' });
      expect(isTransientProviderError(e)).toBe(false);
    }
  });

  it('isTransientProviderError treats network errors (no status) as transient', () => {
    const e = new ProviderError({
      provider: 'google',
      message: 'ECONNRESET',
    });
    expect(isTransientProviderError(e)).toBe(true);
  });
});
