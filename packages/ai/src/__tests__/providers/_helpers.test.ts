import { makeProviderErrorWrapper } from '../../providers/_helpers';
import { ProviderError } from '../../errors';

describe('makeProviderErrorWrapper', () => {
  it('wraps an Error with status into a ProviderError carrying provider/status/cause', () => {
    const wrap = makeProviderErrorWrapper('test-provider');
    const sdkErr = Object.assign(new Error('oops'), { status: 500 });
    expect(() => wrap(sdkErr)).toThrow(ProviderError);
    try {
      wrap(sdkErr);
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      const pe = e as ProviderError;
      expect(pe.provider).toBe('test-provider');
      expect(pe.status).toBe(500);
      expect(pe.message).toContain('oops');
      expect(pe.cause).toBe(sdkErr);
    }
  });

  it('wraps an Error without a status (network error) into a ProviderError with undefined status', () => {
    const wrap = makeProviderErrorWrapper('test-provider');
    const netErr = new Error('ECONNRESET');
    try {
      wrap(netErr);
      fail('expected wrap to throw');
    } catch (e) {
      const pe = e as ProviderError;
      expect(pe.status).toBeUndefined();
      expect(pe.message).toContain('ECONNRESET');
      expect(pe.cause).toBe(netErr);
    }
  });

  it('wraps a non-Error throw (e.g. string) into a ProviderError with String(err) as the message', () => {
    const wrap = makeProviderErrorWrapper('weird');
    try {
      wrap('plain string thrown');
      fail('expected wrap to throw');
    } catch (e) {
      const pe = e as ProviderError;
      expect(pe.provider).toBe('weird');
      expect(pe.message).toContain('plain string thrown');
      expect(pe.cause).toBe('plain string thrown');
    }
  });
});
