import { retryWithBackoff } from '../retry';
import { ProviderError, RetryExhaustedError } from '../errors';

describe('retryWithBackoff', () => {
  it('returns the value on first success without sleeping', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);
    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      sleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries on transient ProviderError up to maxRetries', async () => {
    const transient = new ProviderError({
      provider: 'anthropic',
      status: 503,
      message: 'x',
    });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);
    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 50,
      sleep,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff (base, base*2, base*4, ...)', async () => {
    const transient = new ProviderError({
      provider: 'anthropic',
      status: 500,
      message: 'x',
    });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);
    await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 50,
      sleep,
    });
    expect(sleep).toHaveBeenNthCalledWith(1, 50);
    expect(sleep).toHaveBeenNthCalledWith(2, 100);
  });

  it('throws RetryExhaustedError after maxRetries transient failures', async () => {
    const transient = new ProviderError({
      provider: 'openai',
      status: 503,
      message: 'unavail',
    });
    const fn = jest.fn().mockRejectedValue(transient);
    const sleep = jest.fn().mockResolvedValue(undefined);
    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, sleep }),
    ).rejects.toBeInstanceOf(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry on non-transient ProviderError', async () => {
    const nonTransient = new ProviderError({
      provider: 'openai',
      status: 401,
      message: 'bad key',
    });
    const fn = jest.fn().mockRejectedValue(nonTransient);
    const sleep = jest.fn().mockResolvedValue(undefined);
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, sleep })).rejects.toBe(
      nonTransient,
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry on non-provider errors', async () => {
    const bug = new TypeError('coding bug');
    const fn = jest.fn().mockRejectedValue(bug);
    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, sleep: jest.fn() }),
    ).rejects.toBe(bug);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
