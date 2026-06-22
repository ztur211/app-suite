import { dictationsApi } from '../lib/api';
import { useDictations } from '../store/dictations.store';
import type { Dictation } from '../lib/types';

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

const mockApi = dictationsApi as jest.Mocked<typeof dictationsApi>;

const makeDictation = (overrides: Partial<Dictation> = {}): Dictation =>
  ({
    id: 'd1',
    captureMode: 'tap',
    intent: 'NOTE',
    state: 'proposed',
    finalTranscript: 'buy milk',
    ...overrides,
  }) as Dictation;

beforeEach(() => {
  useDictations.setState({ dictations: [], loading: false, creating: false, error: null });
  jest.clearAllMocks();
});

describe('useDictations.captureAudio', () => {
  it('prepends the created dictation on success and returns true', async () => {
    useDictations.setState({ dictations: [makeDictation({ id: 'old' })] });
    mockApi.createAudio.mockResolvedValueOnce({
      dictation: makeDictation({ id: 'new' }),
      proposal: {} as never,
    });

    const blob = { size: 10, type: 'audio/webm' } as unknown as Blob;
    const ok = await useDictations.getState().captureAudio(blob);

    expect(ok).toBe(true);
    expect(mockApi.createAudio).toHaveBeenCalledWith(blob);
    expect(useDictations.getState().dictations.map((d) => d.id)).toEqual(['new', 'old']);
    expect(useDictations.getState().creating).toBe(false);
  });

  it('sets error and returns false on failure', async () => {
    mockApi.createAudio.mockRejectedValueOnce(new Error('Whisper down'));

    const blob = { size: 10, type: 'audio/webm' } as unknown as Blob;
    const ok = await useDictations.getState().captureAudio(blob);

    expect(ok).toBe(false);
    expect(useDictations.getState().error).toBe('Whisper down');
    expect(useDictations.getState().creating).toBe(false);
  });
});
