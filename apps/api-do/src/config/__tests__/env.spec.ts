import { loadEnv } from '../env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/things_do',
  BETTER_AUTH_SECRET: 'dev-secret-min-8',
  BETTER_AUTH_URL: 'http://localhost:3002',
  SERVICE_TOKEN_SECRET: 'dev-service-secret',
};

describe('api-do loadEnv', () => {
  it('parses a valid env and defaults PORT to 3002', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3002);
    expect(env.SERVICE_TOKEN_SECRET).toBe('dev-service-secret');
  });

  it('coerces a provided PORT to a number', () => {
    expect(loadEnv({ ...base, PORT: '4002' }).PORT).toBe(4002);
  });

  it('throws when SERVICE_TOKEN_SECRET is missing (api-do verifies service JWTs)', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: base.DATABASE_URL,
        BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: base.BETTER_AUTH_URL,
      }),
    ).toThrow(/SERVICE_TOKEN_SECRET/);
  });

  it('rejects a non-URL BETTER_AUTH_URL', () => {
    expect(() => loadEnv({ ...base, BETTER_AUTH_URL: 'not-a-url' })).toThrow();
  });
});
