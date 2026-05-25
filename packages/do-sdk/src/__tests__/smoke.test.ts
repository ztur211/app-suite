import { DoSdk } from '../index';

describe('@things/do-sdk public surface', () => {
  it('exports the DoSdk class', () => {
    expect(typeof DoSdk).toBe('function');
  });

  it('constructs an instance with a tasks API attached', () => {
    const sdk = new DoSdk({
      baseUrl: 'http://example.test',
      callerApp: 'api-say',
      serviceTokenSecret: 'x'.repeat(32),
    });
    expect(sdk.tasks).toBeDefined();
    expect(typeof sdk.tasks.create).toBe('function');
    expect(typeof sdk.tasks.delete).toBe('function');
  });
});
