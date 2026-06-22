import { z } from 'zod';
import { serviceEnvSchema, loadEnv as parseEnv } from '@things/config';

export const envSchema = serviceEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3004),
  /** Base URL of api-say (used by SaySdk for pull-from-pending). */
  SAY_API_URL: z.string().url(),
  /**
   * Product-search providers (all optional). With eBay creds, /items/search
   * uses the eBay Browse API; otherwise it falls back to keyless Open Food
   * Facts. See search/product-search.factory.ts.
   */
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_API_BASE: z.string().url().optional(),
  EBAY_OAUTH_SCOPE: z.string().optional(),
  OFF_API_BASE: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, raw);
}
