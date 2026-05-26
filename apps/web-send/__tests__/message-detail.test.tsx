import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import MessageDetail from '../app/(app)/message/[id]';
import { useMessages } from '../store/messages.store';
import { messagesApi } from '../lib/api';
import type { Message } from '../lib/types';

jest.mock('../lib/api', () => ({
  messagesApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockBack = jest.fn();
const mockParams = { id: 'm1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockApi = messagesApi as jest.Mocked<typeof messagesApi>;

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
  mockParams.id = 'm1';
  mockApi.list.mockResolvedValue([]);
});

describe('Message detail screen', () => {
  it('shows not-found when message is missing', async () => {
    const { findByTestId } = render(<MessageDetail />);
    expect(await findByTestId('message-not-found')).toBeTruthy();
  });

  it('pre-fills the form when found', async () => {
    useMessages.setState({
      messages: [
        makeMessage({
          id: 'm1',
          subject: 'Subject A',
          body: 'Body A',
          recipient: 'jane@example.com',
        }),
      ],
    });
    const { findByDisplayValue } = render(<MessageDetail />);
    expect(await findByDisplayValue('Subject A')).toBeTruthy();
    expect(await findByDisplayValue('Body A')).toBeTruthy();
    expect(await findByDisplayValue('jane@example.com')).toBeTruthy();
  });

  it('saves a body edit and navigates back', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'm1', body: 'Old' })] });
    mockApi.update.mockResolvedValueOnce(makeMessage({ id: 'm1', body: 'New' }));
    const { findByTestId } = render(<MessageDetail />);
    fireEvent.changeText(await findByTestId('edit-body'), 'New');
    await act(async () => {
      fireEvent.press(await findByTestId('save-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('m1', {
      channel: 'email',
      subject: 'Hi',
      body: 'New',
      recipient: null,
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('changes channel via channel buttons (hides subject for slack)', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'm1', channel: 'email' })] });
    const { findByTestId, queryByTestId } = render(<MessageDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('edit-channel-slack'));
    });
    expect(queryByTestId('edit-subject')).toBeNull();
  });

  it('toggles sent via toggle button', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'm1', status: 'draft' })] });
    mockApi.update.mockResolvedValueOnce(makeMessage({ id: 'm1', status: 'sent' }));
    const { findByTestId } = render(<MessageDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('toggle-sent-btn'));
    });
    expect(mockApi.update).toHaveBeenCalledWith('m1', { status: 'sent' });
  });

  it('deletes and navigates back', async () => {
    useMessages.setState({ messages: [makeMessage({ id: 'm1' })] });
    mockApi.remove.mockResolvedValueOnce({ ok: true });
    const { findByTestId } = render(<MessageDetail />);
    await act(async () => {
      fireEvent.press(await findByTestId('delete-btn'));
    });
    expect(mockApi.remove).toHaveBeenCalledWith('m1');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
