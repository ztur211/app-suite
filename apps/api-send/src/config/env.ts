import { z } from 'zod';
import { serviceEnvSchema, loadEnv as parseEnv } from '@things/config';

export const envSchema = serviceEnvSchema.extend({
  PORT: z.coerce.number().int().positive().default(3006),
  /** Base URL of api-say (used by SaySdk to pull PENDING_SEND). Optional; the
   * sync module falls back to localhost. */
  SAY_API_URL: z.string().url().optional(),
  /**
   * Telegram (optional). With a bot token (from @BotFather), outbound send and
   * inbound sync go live; without it the app boots and those are no-ops. See
   * telegram/telegram.factory.ts.
   */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_API_BASE: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: Record<string, string | undefined> = process.env): Env {
  return parseEnv(envSchema, raw);
}
