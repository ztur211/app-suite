import { z } from 'zod';
import { baseEnvSchema, serviceEnvSchema, loadEnv } from '../index';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  BETTER_AUTH_SECRET: 'dev-secret-min-8',
  BETTER_AUTH_URL: 'http://localhost:3001',
};

describe('baseEnvSchema', () => {
  it('parses the three universal fields', () => {
    const env = loadEnv(baseEnvSchema, base);
    expect(env.DATABASE_URL).toBe(base.DATABASE_URL);
    expect(env.BETTER_AUTH_SECRET).toBe(base.BETTER_AUTH_SECRET);
    expect(env.BETTER_AUTH_URL).toBe(base.BETTER_AUTH_URL);
  });

  it('rejects a too-short BETTER_AUTH_SECRET', () => {
    expect(() => loadEnv(baseEnvSchema, { ...base, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /Invalid env/,
    );
  });

  it('rejects a non-URL BETTER_AUTH_URL', () => {
    expect(() => loadEnv(baseEnvSchema, { ...base, BETTER_AUTH_URL: 'not-a-url' })).toThrow();
  });

  it('throws naming the missing field', () => {
    expect(() => loadEnv(baseEnvSchema, {})).toThrow(/DATABASE_URL/);
  });
});

describe('serviceEnvSchema', () => {
  it('extends base with SERVICE_TOKEN_SECRET', () => {
    const env = loadEnv(serviceEnvSchema, { ...base, SERVICE_TOKEN_SECRET: 'svc-secret-8' });
    expect(env.SERVICE_TOKEN_SECRET).toBe('svc-secret-8');
    expect(env.DATABASE_URL).toBe(base.DATABASE_URL);
  });

  it('requires SERVICE_TOKEN_SECRET', () => {
    expect(() => loadEnv(serviceEnvSchema, base)).toThrow(/SERVICE_TOKEN_SECRET/);
  });
});

describe('loadEnv with an app-extended schema', () => {
  it('validates extras and coerces/defaults PORT', () => {
    const schema = serviceEnvSchema.extend({
      PORT: z.coerce.number().int().positive().default(3003),
      DO_API_URL: z.string().url(),
    });
    const env = loadEnv(schema, {
      ...base,
      SERVICE_TOKEN_SECRET: 's-8-chars',
      DO_API_URL: 'http://api-do:3002',
    });
    expect(env.PORT).toBe(3003); // default applied
    expect(env.DO_API_URL).toBe('http://api-do:3002');
  });
});
