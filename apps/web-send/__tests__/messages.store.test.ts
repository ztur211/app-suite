import { messagesApi } from '../lib/api';
import { useMessages } from '../store/messages.store';
import type { Message } from '../lib/types';

jest.mock('../lib/api', () => ({
  messagesApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    send: jest.fn(),
    sync: jest.fn(),
    linkTelegram: jest.fn(),
    syncFromSay: jest.fn(),
  },
}));

const mockApi = messagesApi as jest.Mocked<typeof messagesApi>;

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  userId: 'u1',
  channel: 'email',
  kind: 'outbound',
  status: 'draft',
  subject: 'Hi',
  body: 'Hello',
  recipient: null,
  sourceDictationId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  useMessages.setState({
    messages: [],
    loading: false,
    error: null,
    syncing: false,
    syncSummary: null,
    saySummary: null,
    telegramChatId: null,
  });
  jest.clearAllMocks();
});

describe('useMessages store', () => {
  it('refresh() loads messages', async () => {
    const rows = [makeMessage({ id: 'a' })];
    mockApi.list.mockResolvedValueOnce(rows);
    await useMessages.getState().refresh();
    expect(useMessages.getState().messages).toEqual(rows);
  });

  it('refresh() stores error on failure', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('Network'));
    await useMessages.getState().refresh();
    expect(useMessages.getState().error).toBe('Network');
  });

  it('create() prepends', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'old' })] });
    mockApi.create.mockResolvedValueOnce(makeMessage({ id: 'new', body: 'fresh' }));
    await useMessages.getState().create({ channel: 'email', body: 'fresh' });
    expect(useMessages.getState().messages.map((m) => m.id)).toEqual(['new', 'old']);
  });

  it('update() optimistically merges then replaces', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'm1', status: 'draft' })] });
    const final = makeMessage({ id: 'm1', status: 'sent' });
    mockApi.update.mockResolvedValueOnce(final);
    const p = useMessages.getState().update('m1', { status: 'sent' });
    expect(useMessages.getState().messages[0].status).toBe('sent');
    await p;
    expect(useMessages.getState().messages[0]).toEqual(final);
  });

  it('remove() optimistically removes', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'a' }), makeMessage({ id: 'b' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    await useMessages.getState().remove('a');
    expect(useMessages.getState().messages.map((m) => m.id)).toEqual(['b']);
  });

  it('byId() returns matching message or undefined', () => {
    const a = makeMessage({ id: 'a' });
    useMessages.setState({ messages: [a] });
    expect(useMessages.getState().byId('a')).toBe(a);
    expect(useMessages.getState().byId('missing')).toBeUndefined();
  });

  it('send() replaces the message with the API response', async () => {
    useMessages.setState({
      messages: [makeMessage({ id: 'm1', status: 'draft', channel: 'telegram' })],
    });
    mockApi.send.mockResolvedValueOnce(
      makeMessage({ id: 'm1', status: 'sent', channel: 'telegram' }),
    );
    await useMessages.getState().send('m1');
    expect(mockApi.send).toHaveBeenCalledWith('m1');
    expect(useMessages.getState().messages[0].status).toBe('sent');
  });

  it('sync() pulls inbound then refreshes the list', async () => {
    mockApi.sync.mockResolvedValueOnce({ inboundCreated: 1, processed: 2 });
    mockApi.list.mockResolvedValueOnce([
      makeMessage({ id: 'in', kind: 'inbound', status: 'unread' }),
    ]);
    await useMessages.getState().sync();
    expect(useMessages.getState().syncSummary).toEqual({ inboundCreated: 1, processed: 2 });
    expect(useMessages.getState().messages).toHaveLength(1);
    expect(useMessages.getState().syncing).toBe(false);
  });

  it('linkTelegram() stores the linked chatId', async () => {
    mockApi.linkTelegram.mockResolvedValueOnce({ ok: true, chatId: '77' });
    await useMessages.getState().linkTelegram('77');
    expect(mockApi.linkTelegram).toHaveBeenCalledWith('77');
    expect(useMessages.getState().telegramChatId).toBe('77');
  });

  it('syncFromSay() pulls Say drafts then refreshes the list', async () => {
    mockApi.syncFromSay.mockResolvedValueOnce({ created: 2, consumed: 2 });
    mockApi.list.mockResolvedValueOnce([
      makeMessage({ id: 'd', channel: 'email', sourceDictationId: 'dict1' }),
    ]);
    await useMessages.getState().syncFromSay();
    expect(useMessages.getState().saySummary).toEqual({ created: 2, consumed: 2 });
    expect(useMessages.getState().messages).toHaveLength(1);
  });
});
