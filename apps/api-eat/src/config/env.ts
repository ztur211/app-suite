import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().int().positive().default(3005),
  BETTER_AUTH_SECRET: z.string().min(8),
  BETTER_AUTH_URL: z.string().url(),
  SERVICE_TOKEN_SECRET: z.string().min(8),
  /** Base URL of api-say (used by SaySdk for pull-from-pending). */
  SAY_API_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
