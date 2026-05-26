import { messagesApi } from '../lib/api';
import { useMessages } from '../store/messages.store';
import type { Message } from '../lib/types';

jest.mock('../lib/api', () => ({
  messagesApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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
  useMessages.setState({ messages: [], loading: false, error: null });
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
});
