import { loadEnv } from '../env';

const baseEnv: Record<string, string> = {
  DATABASE_URL: 'file:./test.db',
  BETTER_AUTH_SECRET: 'a-secret-min-8-chars',
  BETTER_AUTH_URL: 'http://localhost:3006',
  SERVICE_TOKEN_SECRET: 'a-service-secret-min-8-chars',
};

describe('loadEnv', () => {
  it('parses a valid env', () => {
    const env = loadEnv(baseEnv);
    expect(env.DATABASE_URL).toBe('file:./test.db');
    expect(env.PORT).toBe(3006);
  });

  it('coerces PORT from string', () => {
    expect(loadEnv({ ...baseEnv, PORT: '3016' }).PORT).toBe(3016);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = baseEnv;
    expect(() => loadEnv(rest)).toThrow(/Invalid env/);
  });

  it('throws when BETTER_AUTH_SECRET is too short', () => {
    expect(() => loadEnv({ ...baseEnv, BETTER_AUTH_SECRET: 'short' })).toThrow(/Invalid env/);
  });

  it('throws when BETTER_AUTH_URL is not a URL', () => {
    expect(() => loadEnv({ ...baseEnv, BETTER_AUTH_URL: 'not-a-url' })).toThrow(/Invalid env/);
  });
});
