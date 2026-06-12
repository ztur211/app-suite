import { z } from 'zod';
import { baseEnvSchema, loadEnv as parseEnv } from '@things/config';

// api-auth is the session issuer; it does not make service-to-service calls,
// so it uses baseEnvSchema (no SERVICE_TOKEN_SECRET).
export const envSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, raw);
}
