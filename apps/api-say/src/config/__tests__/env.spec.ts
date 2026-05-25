import { loadEnv } from '../env';

const baseEnv = {
  DATABASE_URL: 'file:./test.db',
  PORT: '3003',
  BETTER_AUTH_SECRET: 'dev-secret-min-8-chars',
  BETTER_AUTH_URL: 'http://localhost:3001',
  SERVICE_TOKEN_SECRET: 'dev-service-secret',
  DO_API_URL: 'http://localhost:3002',
  OPENAI_API_KEY: 'sk-x',
  ANTHROPIC_API_KEY: 'sk-ant-x',
  TMP_AUDIO_DIR: './tmp',
};

describe('loadEnv', () => {
  it('parses a valid env and coerces PORT to number', () => {
    const env = loadEnv(baseEnv);
    expect(env.PORT).toBe(3003);
    expect(env.TMP_AUDIO_DIR).toBe('./tmp');
    expect(env.DATABASE_URL).toBe('file:./test.db');
  });

  it('throws on missing required env', () => {
    expect(() => loadEnv({ DATABASE_URL: 'file:./test.db' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('throws on non-numeric PORT', () => {
    expect(() => loadEnv({ ...baseEnv, PORT: 'abc' })).toThrow();
  });

  it('defaults TMP_AUDIO_DIR when omitted', () => {
    const env = loadEnv({ ...baseEnv, TMP_AUDIO_DIR: undefined });
    expect(env.TMP_AUDIO_DIR).toBe('./tmp');
  });

  it('rejects a non-URL BETTER_AUTH_URL', () => {
    expect(() => loadEnv({ ...baseEnv, BETTER_AUTH_URL: 'not-a-url' })).toThrow();
  });
});
