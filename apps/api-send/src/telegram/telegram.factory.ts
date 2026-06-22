import { ServiceUnavailableException } from '@nestjs/common';
import { TelegramAdapter, type TelegramSendResult, type TelegramUpdate } from './telegram.adapter';
import { BotTelegramAdapter } from './bot-telegram.adapter';

/**
 * No-op used when no bot token is configured: the app still boots, inbound
 * sync is a harmless no-op, and sending returns a clear 503. Kept here (not in
 * the module) so the factory is unit-testable without the auth import chain.
 */
class NoopTelegramAdapter extends TelegramAdapter {
  async sendMessage(): Promise<TelegramSendResult> {
    throw new ServiceUnavailableException('Telegram is not configured (set TELEGRAM_BOT_TOKEN)');
  }
  async getUpdates(): Promise<TelegramUpdate[]> {
    return [];
  }
}

export function createTelegramAdapter(
  env: Record<string, string | undefined> = process.env,
): TelegramAdapter {
  const token = env['TELEGRAM_BOT_TOKEN'];
  if (!token) return new NoopTelegramAdapter();
  return new BotTelegramAdapter({ token, base: env['TELEGRAM_API_BASE'] });
}
