import { ProviderError } from '../errors';

/**
 * Returns an `(err: unknown) => never` function that wraps any thrown value
 * into a `ProviderError` tagged with `providerId`. Use this in provider
 * factories so all three providers wrap SDK errors uniformly.
 */
export function makeProviderErrorWrapper(providerId: string): (err: unknown) => never {
  return (err) => {
    if (err instanceof Error) {
      const status = (err as { status?: number }).status;
      throw new ProviderError({
        provider: providerId,
        status,
        message: err.message,
        cause: err,
      });
    }
    throw new ProviderError({
      provider: providerId,
      message: String(err),
      cause: err,
    });
  };
}
