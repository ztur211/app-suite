import { z } from 'zod';
import { serviceEnvSchema, loadEnv as parseEnv } from '@things/config';

export const envSchema = serviceEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3004),
  /** Base URL of api-say (used by SaySdk for pull-from-pending). */
  SAY_API_URL: z.string().url(),
  /**
   * Product-search stores (all optional). Every store whose creds are present
   * is searched and the results are merged; with none set, /items/search falls
   * back to keyless Open Food Facts. See search/product-search.factory.ts.
   */
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_API_BASE: z.string().url().optional(),
  EBAY_OAUTH_SCOPE: z.string().optional(),
  OFF_API_BASE: z.string().url().optional(),
  // Best Buy (electronics) — simple key.
  BESTBUY_API_KEY: z.string().optional(),
  BESTBUY_API_BASE: z.string().url().optional(),
  // Etsy (handmade/vintage) — app keystring, public listing search.
  ETSY_API_KEY: z.string().optional(),
  ETSY_API_BASE: z.string().url().optional(),
  // AliExpress affiliate — signed requests (app key + secret), approval-gated.
  ALIEXPRESS_APP_KEY: z.string().optional(),
  ALIEXPRESS_APP_SECRET: z.string().optional(),
  ALIEXPRESS_TRACKING_ID: z.string().optional(),
  ALIEXPRESS_API_BASE: z.string().url().optional(),
  // Kroger (grocery) — OAuth2 client-credentials; locationId enables pricing.
  KROGER_CLIENT_ID: z.string().optional(),
  KROGER_CLIENT_SECRET: z.string().optional(),
  KROGER_LOCATION_ID: z.string().optional(),
  KROGER_API_BASE: z.string().url().optional(),
  // SerpApi — Google Shopping (+ walmart/amazon/home_depot via SERPAPI_ENGINE).
  SERPAPI_KEY: z.string().optional(),
  SERPAPI_ENGINE: z.string().optional(),
  SERPAPI_API_BASE: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, raw);
}
