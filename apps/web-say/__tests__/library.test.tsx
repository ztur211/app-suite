import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Library from '../app/(app)/index';
import { useAuth } from '@things/web-kit';
import { useDictations } from '../store/dictations.store';
import { dictationsApi } from '../lib/api';
import { isRecordingSupported, startRecording } from '../lib/recorder';
import type { Dictation } from '../lib/types';

jest.mock('@things/web-kit', () => ({ useAuth: jest.fn() }));

jest.mock('../lib/api', () => ({
  dictationsApi: {
    list: jest.fn(),
    create: jest.fn(),
    createAudio: jest.fn(),
    dispatch: jest.fn(),
    undoDispatch: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../lib/recorder', () => ({
  isRecordingSupported: jest.fn(),
  startRecording: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

const mockApi = dictationsApi as jest.Mocked<typeof dictationsApi>;
const mockIsSupported = isRecordingSupported as jest.Mock;
const mockStartRecording = startRecording as jest.Mock;

const makeDictation = (overrides: Partial<Dictation> = {}): Dictation =>
  ({
    id: 'd1',
    captureMode: 'tap',
    intent: 'NOTE',
    state: 'proposed',
    finalTranscript: 'a note',
    ...overrides,
  }) as Dictation;

beforeEach(() => {
  jest.clearAllMocks();
  useDictations.setState({ dictations: [], loading: false, creating: false, error: null });
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'u1', email: 'test@example.com', name: 'test' },
    signOut: jest.fn(),
  });
  mockApi.list.mockResolvedValue([]);
  mockIsSupported.mockReturnValue(true);
});

describe('Say library — voice capture', () => {
  it('shows the record button when recording is supported', async () => {
    const { findByTestId } = render(<Library />);
    expect(await findByTestId('record-btn')).toBeTruthy();
  });

  it('hides the record button when recording is unsupported', async () => {
    mockIsSupported.mockReturnValue(false);
    const { queryByTestId, findByTestId } = render(<Library />);
    await findByTestId('capture-btn'); // screen mounted
    expect(queryByTestId('record-btn')).toBeNull();
  });

  it('records then transcribes: stop() -> captureAudio -> new dictation appears', async () => {
    const blob = { size: 99, type: 'audio/webm' } as unknown as Blob;
    const stop = jest.fn().mockResolvedValue(blob);
    mockStartRecording.mockResolvedValue({ stop });
    mockApi.createAudio.mockResolvedValueOnce({
      dictation: makeDictation({ id: 'voiced', finalTranscript: 'walk the dog' }),
      proposal: {} as never,
    });

    const { findByTestId, findByText } = render(<Library />);
    const btn = await findByTestId('record-btn');

    await act(async () => {
      fireEvent.press(btn); // start
    });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(await findByTestId('recording-indicator')).toBeTruthy();

    await act(async () => {
      fireEvent.press(btn); // stop
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(mockApi.createAudio).toHaveBeenCalledWith(blob);
    expect(await findByText('walk the dog')).toBeTruthy();
  });

  it('still supports typed capture', async () => {
    mockApi.create.mockResolvedValueOnce({
      dictation: makeDictation({ id: 'typed', finalTranscript: 'buy eggs' }),
      proposal: {} as never,
    });
    const { getByTestId, findByText } = render(<Library />);
    await waitFor(() => expect(getByTestId('capture-input')).toBeTruthy());
    fireEvent.changeText(getByTestId('capture-input'), 'buy eggs');
    await act(async () => {
      fireEvent.press(getByTestId('capture-btn'));
    });
    expect(mockApi.create).toHaveBeenCalledWith('buy eggs');
    expect(await findByText('buy eggs')).toBeTruthy();
  });
});
