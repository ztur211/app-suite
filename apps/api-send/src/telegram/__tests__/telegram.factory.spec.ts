import { createTelegramAdapter } from '../telegram.factory';
import { BotTelegramAdapter } from '../bot-telegram.adapter';

describe('createTelegramAdapter', () => {
  it('returns a live Bot adapter when TELEGRAM_BOT_TOKEN is set', () => {
    expect(createTelegramAdapter({ TELEGRAM_BOT_TOKEN: 'tok' })).toBeInstanceOf(BotTelegramAdapter);
  });

  it('returns a no-op adapter without a token (getUpdates -> [], sendMessage -> 503)', async () => {
    const adapter = createTelegramAdapter({});
    expect(await adapter.getUpdates()).toEqual([]);
    await expect(adapter.sendMessage('1', 'x')).rejects.toThrow('not configured');
  });
});
