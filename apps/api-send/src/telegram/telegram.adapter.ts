/**
 * Provider seam for Telegram. The abstract class doubles as the Nest DI token
 * so tests can swap a fake via `.overrideProvider(TelegramAdapter)`. The live
 * implementation is BotTelegramAdapter; when no bot token is configured the
 * factory supplies a no-op (see telegram.factory.ts).
 */

export interface TelegramSendResult {
  /** Telegram's message_id for the sent message. */
  providerMessageId: string;
  chatId: string;
}

export interface TelegramUpdate {
  /** Globally-monotonic per-bot id; used for dedup + offset advancement. */
  updateId: number;
  chatId: string;
  fromUsername: string | null;
  text: string;
  /** Unix seconds. */
  date: number;
}

export abstract class TelegramAdapter {
  abstract sendMessage(chatId: string, text: string): Promise<TelegramSendResult>;
  /** Long-poll-free fetch of pending updates after `offset`. */
  abstract getUpdates(offset?: number): Promise<TelegramUpdate[]>;
}
