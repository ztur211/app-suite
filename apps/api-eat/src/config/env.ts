import { z } from 'zod';
import { serviceEnvSchema, loadEnv as parseEnv } from '@things/config';

export const envSchema = serviceEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3005),
  /** Base URL of api-say (used by SaySdk for pull-from-pending). */
  SAY_API_URL: z.string().url(),
  /**
   * Discovery providers (all optional). Recipes always use keyless TheMealDB;
   * restaurants use Yelp when YELP_API_KEY is set. See discovery.factory.ts.
   */
  YELP_API_KEY: z.string().optional(),
  YELP_API_BASE: z.string().url().optional(),
  EAT_DEFAULT_LOCATION: z.string().optional(),
  MEALDB_API_KEY: z.string().optional(),
  MEALDB_API_BASE: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, raw);
}
