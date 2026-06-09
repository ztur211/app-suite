import { trustedWebOrigins, authCookieDomain } from '../origins';

describe('trustedWebOrigins', () => {
  it('adds the five web subdomains when THINGS_DOMAIN is set', () => {
    expect(trustedWebOrigins({ THINGS_DOMAIN: 'things.test' })).toEqual(
      expect.arrayContaining([
        'https://do.things.test',
        'https://say.things.test',
        'https://buy.things.test',
        'https://eat.things.test',
        'https://send.things.test',
      ]),
    );
  });

  it('always includes the localhost dev origins 8081-8085', () => {
    expect(trustedWebOrigins({ THINGS_DOMAIN: 'things.test' })).toEqual(
      expect.arrayContaining(['http://localhost:8081', 'http://localhost:8085']),
    );
  });

  it('returns only dev origins when THINGS_DOMAIN is unset', () => {
    expect(trustedWebOrigins({})).toEqual([
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'http://localhost:8084',
      'http://localhost:8085',
    ]);
  });
});

describe('authCookieDomain', () => {
  it('returns the domain when set', () => {
    expect(authCookieDomain({ AUTH_COOKIE_DOMAIN: '.things.test' })).toBe('.things.test');
  });
  it('returns undefined when unset or empty', () => {
    expect(authCookieDomain({})).toBeUndefined();
    expect(authCookieDomain({ AUTH_COOKIE_DOMAIN: '' })).toBeUndefined();
  });
});
