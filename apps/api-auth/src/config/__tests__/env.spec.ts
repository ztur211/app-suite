import { loadEnv } from '../env';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/things_auth',
  BETTER_AUTH_SECRET: 'dev-secret-min-8',
  BETTER_AUTH_URL: 'http://localhost:3001',
};

describe('api-auth loadEnv', () => {
  it('parses a valid env and defaults PORT to 3001', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toBe(base.DATABASE_URL);
  });

  it('coerces a provided PORT to a number', () => {
    expect(loadEnv({ ...base, PORT: '4001' }).PORT).toBe(4001);
  });

  it('throws when BETTER_AUTH_SECRET is missing', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: base.DATABASE_URL, BETTER_AUTH_URL: base.BETTER_AUTH_URL }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('does not require SERVICE_TOKEN_SECRET (api-auth is the issuer, not a caller)', () => {
    expect(loadEnv(base).PORT).toBe(3001);
  });
});
