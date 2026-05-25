import { SaySdk } from '../index';

describe('@things/say-sdk public surface', () => {
  it('exports the SaySdk class', () => {
    expect(typeof SaySdk).toBe('function');
  });

  it('constructs an instance with a pending API attached', () => {
    const sdk = new SaySdk({
      baseUrl: 'http://example.test',
      callerService: 'api-buy',
      serviceTokenSecret: 'x'.repeat(32),
    });
    expect(sdk.pending).toBeDefined();
    expect(typeof sdk.pending.list).toBe('function');
    expect(typeof sdk.pending.consume).toBe('function');
  });
});
