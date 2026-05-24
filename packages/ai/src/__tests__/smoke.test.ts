import {
  createAiClient,
  defaultRouteConfig,
  noopUsageLogger,
  AiError,
  ProviderError,
  RetryExhaustedError,
  RouteUnavailableError,
  createAnthropicProvider,
  createOpenAIProvider,
  createGoogleProvider,
} from '../index';

describe('@things/ai public surface', () => {
  it('exports the client factory', () => {
    expect(typeof createAiClient).toBe('function');
  });

  it('exports defaultRouteConfig with all six operations', () => {
    const ops = ['chat', 'chatStructured', 'summarize', 'transcribe', 'embed', 'vision'];
    for (const op of ops) {
      expect(defaultRouteConfig).toHaveProperty(op);
    }
  });

  it('exports the error hierarchy', () => {
    expect(typeof AiError).toBe('function');
    expect(typeof ProviderError).toBe('function');
    expect(typeof RetryExhaustedError).toBe('function');
    expect(typeof RouteUnavailableError).toBe('function');
  });

  it('exports the no-op usage logger', () => {
    expect(typeof noopUsageLogger).toBe('function');
  });

  it('exports the provider factories', () => {
    expect(typeof createAnthropicProvider).toBe('function');
    expect(typeof createOpenAIProvider).toBe('function');
    expect(typeof createGoogleProvider).toBe('function');
  });
});
