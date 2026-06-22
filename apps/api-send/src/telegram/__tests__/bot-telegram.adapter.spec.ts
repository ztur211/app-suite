jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from 'axios';
import { BotTelegramAdapter } from '../bot-telegram.adapter';

const mockGet = axios.get as jest.Mock;
const mockPost = axios.post as jest.Mock;

const adapter = () => new BotTelegramAdapter({ token: 'TOK', base: 'https://tg.test' });

describe('BotTelegramAdapter (unit)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sendMessage posts to /bot<token>/sendMessage and returns the message id', async () => {
    mockPost.mockResolvedValueOnce({
      data: { ok: true, result: { message_id: 42, chat: { id: 99 } } },
    });

    const result = await adapter().sendMessage('99', 'hello');

    const [url, body] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('https://tg.test/botTOK/sendMessage');
    expect(body).toEqual({ chat_id: '99', text: 'hello' });
    expect(result).toEqual({ providerMessageId: '42', chatId: '99' });
  });

  it('getUpdates passes the offset and maps only text messages', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        ok: true,
        result: [
          {
            update_id: 10,
            message: {
              message_id: 1,
              chat: { id: 99, username: 'alice' },
              from: { username: 'alice' },
              text: 'hi',
              date: 123,
            },
          },
          { update_id: 11, message: { message_id: 2, chat: { id: 99 }, text: '', date: 124 } },
          { update_id: 12 }, // no message at all
        ],
      },
    });

    const updates = await adapter().getUpdates(10);

    const [url, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(url).toBe('https://tg.test/botTOK/getUpdates');
    expect(config.params).toMatchObject({ offset: 10, timeout: 0 });
    expect(updates).toEqual([
      { updateId: 10, chatId: '99', fromUsername: 'alice', text: 'hi', date: 123 },
    ]);
  });

  it('getUpdates returns [] when result is empty', async () => {
    mockGet.mockResolvedValueOnce({ data: { ok: true, result: [] } });
    expect(await adapter().getUpdates()).toEqual([]);
  });
});
