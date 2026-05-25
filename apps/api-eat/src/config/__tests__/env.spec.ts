import { loadEnv } from '../env';

const baseEnv: Record<string, string> = {
  DATABASE_URL: 'file:./test.db',
  BETTER_AUTH_SECRET: 'a-secret-min-8-chars',
  BETTER_AUTH_URL: 'http://localhost:3005',
  SERVICE_TOKEN_SECRET: 'a-service-secret-min-8-chars',
  SAY_API_URL: 'http://localhost:3003',
};

describe('loadEnv', () => {
  it('parses a valid env', () => {
    const env = loadEnv(baseEnv);
    expect(env.DATABASE_URL).toBe('file:./test.db');
    expect(env.PORT).toBe(3005);
  });

  it('coerces PORT from string', () => {
    expect(loadEnv({ ...baseEnv, PORT: '3015' }).PORT).toBe(3015);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omit, ...rest } = baseEnv;
    expect(() => loadEnv(rest)).toThrow(/Invalid env/);
  });

  it('throws when BETTER_AUTH_SECRET is too short', () => {
    expect(() => loadEnv({ ...baseEnv, BETTER_AUTH_SECRET: 'short' })).toThrow(/Invalid env/);
  });

  it('throws when SAY_API_URL is not a URL', () => {
    expect(() => loadEnv({ ...baseEnv, SAY_API_URL: 'not-a-url' })).toThrow(/Invalid env/);
  });
});
