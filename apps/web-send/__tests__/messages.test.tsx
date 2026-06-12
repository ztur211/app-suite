import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Messages from '../app/(app)/index';
import { useAuth } from '@things/web-kit';
import { useMessages } from '../store/messages.store';
import { messagesApi } from '../lib/api';
import type { Message } from '../lib/types';

jest.mock('@things/web-kit', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  messagesApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockApi = messagesApi as jest.Mocked<typeof messagesApi>;
const mockSignOut = jest.fn();

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  userId: 'u1',
  channel: 'email',
  kind: 'outbound',
  status: 'draft',
  subject: 'Hi',
  body: 'Hello there',
  recipient: null,
  sourceDictationId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  useMessages.setState({ messages: [], loading: false, error: null });
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'u1', email: 'test@example.com', name: 'test' },
    signOut: mockSignOut,
  });
  mockApi.list.mockResolvedValue([]);
});

describe('Messages screen', () => {
  it('renders the Messages heading', async () => {
    const { findByText } = render(<Messages />);
    expect(await findByText('Messages')).toBeTruthy();
  });

  it('shows an empty state when no messages', async () => {
    const { findByTestId, findByText } = render(<Messages />);
    expect(await findByTestId('empty-state')).toBeTruthy();
    expect(await findByText('No drafts')).toBeTruthy();
  });

  it('creates an email draft via the form', async () => {
    mockApi.create.mockResolvedValueOnce(
      makeMessage({ id: 'm2', subject: 'Hello', body: 'Friend', channel: 'email' }),
    );
    const { getByTestId, findByText } = render(<Messages />);
    await waitFor(() => expect(getByTestId('message-body')).toBeTruthy());
    fireEvent.changeText(getByTestId('message-subject'), 'Hello');
    fireEvent.changeText(getByTestId('message-body'), 'Friend');
    await act(async () => {
      fireEvent.press(getByTestId('message-add-btn'));
    });
    expect(mockApi.create).toHaveBeenCalledWith({
      channel: 'email',
      subject: 'Hello',
      body: 'Friend',
      recipient: null,
    });
    expect(await findByText('Hello')).toBeTruthy();
  });

  it('switches channel to slack and hides subject field', async () => {
    mockApi.create.mockResolvedValueOnce(makeMessage({ id: 'm3', channel: 'slack' }));
    const { getByTestId, queryByTestId } = render(<Messages />);
    await waitFor(() => expect(getByTestId('channel-slack')).toBeTruthy());
    await act(async () => {
      fireEvent.press(getByTestId('channel-slack'));
    });
    expect(queryByTestId('message-subject')).toBeNull();
  });

  it('toggles sent when checkbox is pressed', async () => {
    const msg = makeMessage({ id: 'm3', status: 'draft' });
    mockApi.list.mockResolvedValueOnce([msg]);
    mockApi.update.mockResolvedValueOnce({ ...msg, status: 'sent' });
    const { findByTestId } = render(<Messages />);
    const checkbox = await findByTestId('checkbox-m3');
    await act(async () => {
      fireEvent.press(checkbox);
    });
    expect(mockApi.update).toHaveBeenCalledWith('m3', { status: 'sent' });
  });

  it('navigates to message detail when card is pressed', async () => {
    const msg = makeMessage({ id: 'm7', subject: 'Curry' });
    mockApi.list.mockResolvedValueOnce([msg]);
    const { findByTestId } = render(<Messages />);
    const card = await findByTestId('message-card-m7');
    await act(async () => {
      fireEvent.press(card);
    });
    expect(mockPush).toHaveBeenCalledWith('/message/m7');
  });

  it('deletes a message', async () => {
    const msg = makeMessage({ id: 'm4', subject: 'Bye' });
    mockApi.list.mockResolvedValueOnce([msg]);
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    const { findByTestId, queryByText } = render(<Messages />);
    const del = await findByTestId('delete-m4');
    await act(async () => {
      fireEvent.press(del);
    });
    expect(mockApi.remove).toHaveBeenCalledWith('m4');
    await waitFor(() => expect(queryByText('Bye')).toBeNull());
  });

  it('switches filter to Sent tab', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeMessage({ id: 'a', subject: 'Active msg', status: 'draft' }),
      makeMessage({ id: 'b', subject: 'Done msg', status: 'sent' }),
    ]);
    const { findByText, findByTestId, queryByText } = render(<Messages />);
    await findByText('Active msg');
    await act(async () => {
      fireEvent.press(await findByTestId('tab-sent'));
    });
    expect(await findByText('Done msg')).toBeTruthy();
    expect(queryByText('Active msg')).toBeNull();
  });

  it('marks Say-sourced messages in the list', async () => {
    mockApi.list.mockResolvedValueOnce([makeMessage({ id: 'm9', sourceDictationId: 'd1' })]);
    const { findByTestId } = render(<Messages />);
    expect(await findByTestId('from-say-m9')).toBeTruthy();
  });

  it('shows the channel badge for each message', async () => {
    mockApi.list.mockResolvedValueOnce([
      makeMessage({ id: 'm1', channel: 'email' }),
      makeMessage({ id: 'm2', channel: 'slack' }),
    ]);
    const { findByTestId } = render(<Messages />);
    expect(await findByTestId('channel-badge-m1')).toBeTruthy();
    expect(await findByTestId('channel-badge-m2')).toBeTruthy();
  });

  it('shows a list error when refresh fails', async () => {
    mockApi.list.mockRejectedValueOnce(new Error('boom'));
    const { findByTestId } = render(<Messages />);
    expect(await findByTestId('list-error')).toBeTruthy();
  });

  it('calls signOut when sign out is pressed', async () => {
    const { findByTestId } = render(<Messages />);
    const out = await findByTestId('sign-out');
    await act(async () => {
      fireEvent.press(out);
    });
    expect(mockSignOut).toHaveBeenCalled();
  });
});
