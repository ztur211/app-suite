import { z } from 'zod';
import { serviceEnvSchema, loadEnv as parseEnv } from '@things/config';

export const envSchema = serviceEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3004),
  /** Base URL of api-say (used by SaySdk for pull-from-pending). */
  SAY_API_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, raw);
}
