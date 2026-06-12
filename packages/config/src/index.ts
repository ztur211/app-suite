import { z } from 'zod';

export const PACKAGE_NAME = '@things/config' as const;

/**
 * Env vars every Things API needs. Apps extend this with their own fields
 * (PORT default, app-specific URLs/keys) via `baseEnvSchema.extend({ ... })`.
 */
export const baseEnvSchema = z.object({
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string().min(8),
  BETTER_AUTH_URL: z.string().url(),
});

/**
 * Base + the service-to-service JWT secret. Used by every API that signs or
 * verifies service tokens (all except api-auth, the issuer).
 */
export const serviceEnvSchema = baseEnvSchema.extend({
  SERVICE_TOKEN_SECRET: z.string().min(8),
});

/**
 * Validate `raw` against `schema`, returning the parsed (coerced/defaulted)
 * env or throwing a clear error. Call once at boot for fail-fast validation.
 */
export function loadEnv<S extends z.ZodTypeAny>(
  schema: S,
  raw: Record<string, string | undefined> = process.env,
): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data as z.infer<S>;
}
