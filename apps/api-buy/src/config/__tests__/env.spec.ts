import { loadEnv } from '../env';

const baseEnv: Record<string, string> = {
  DATABASE_URL: 'file:./test.db',
  BETTER_AUTH_SECRET: 'a-secret-min-8-chars',
  BETTER_AUTH_URL: 'http://localhost:3004',
  SERVICE_TOKEN_SECRET: 'a-service-secret-min-8-chars',
  SAY_API_URL: 'http://localhost:3003',
};

describe('loadEnv', () => {
  it('parses a valid env', () => {
    const env = loadEnv(baseEnv);
    expect(env.DATABASE_URL).toBe('file:./test.db');
    expect(env.PORT).toBe(3004);
    expect(env.SAY_API_URL).toBe('http://localhost:3003');
  });

  it('coerces PORT from string', () => {
    const env = loadEnv({ ...baseEnv, PORT: '3014' });
    expect(env.PORT).toBe(3014);
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

  it('throws when SERVICE_TOKEN_SECRET is too short', () => {
    expect(() => loadEnv({ ...baseEnv, SERVICE_TOKEN_SECRET: '1' })).toThrow(/Invalid env/);
  });
});
