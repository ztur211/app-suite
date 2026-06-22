import axios from 'axios';
import { TelegramAdapter, type TelegramSendResult, type TelegramUpdate } from './telegram.adapter';

/**
 * Live Telegram Bot API adapter. Outbound via sendMessage; inbound via
 * getUpdates with timeout=0 (non-blocking) so it fits the on-demand sync model
 * (no webhook). Don't call setWebhook for this bot — it conflicts with
 * getUpdates. Docs: https://core.telegram.org/bots/api
 */
interface TgChat {
  id: number;
  username?: string;
}
interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: { username?: string };
  text?: string;
  date: number;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export class BotTelegramAdapter extends TelegramAdapter {
  private readonly api: string;

  constructor(opts: { token: string; base?: string }) {
    super();
    const base = opts.base ?? 'https://api.telegram.org';
    this.api = `${base}/bot${opts.token}`;
  }

  async sendMessage(chatId: string, text: string): Promise<TelegramSendResult> {
    const { data } = await axios.post<{ ok: boolean; result: TgMessage }>(
      `${this.api}/sendMessage`,
      { chat_id: chatId, text },
      { timeout: 10_000 },
    );
    return {
      providerMessageId: String(data.result.message_id),
      chatId: String(data.result.chat.id),
    };
  }

  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    const { data } = await axios.get<{ ok: boolean; result: TgUpdate[] }>(
      `${this.api}/getUpdates`,
      { params: { offset, timeout: 0 }, timeout: 15_000 },
    );
    return (data.result ?? [])
      .filter((u): u is TgUpdate & { message: TgMessage } => Boolean(u.message?.text))
      .map((u) => ({
        updateId: u.update_id,
        chatId: String(u.message.chat.id),
        fromUsername: u.message.from?.username ?? u.message.chat.username ?? null,
        text: u.message.text ?? '',
        date: u.message.date,
      }));
  }
}
