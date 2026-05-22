import { authApi } from '../lib/api';
import { useAuth } from '../store/auth.store';

jest.mock('../lib/api', () => ({
  authApi: {
    getSession: jest.fn(),
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

beforeEach(() => {
  // Reset the store state between tests
  useAuth.setState({ user: null, loading: true });
  jest.clearAllMocks();
});

describe('useAuth store', () => {
  it('starts with user: null and loading: true', () => {
    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
  });

  it('init() sets user from session and loading: false', async () => {
    const session = { user: { id: '1', email: 'a@b.com', name: 'a' } };
    mockAuthApi.getSession.mockResolvedValueOnce(session);

    await useAuth.getState().init();

    const state = useAuth.getState();
    expect(state.user).toEqual(session.user);
    expect(state.loading).toBe(false);
  });

  it('init() sets user: null on no session', async () => {
    mockAuthApi.getSession.mockResolvedValueOnce(null);

    await useAuth.getState().init();

    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('init() sets user: null on error and loading: false', async () => {
    mockAuthApi.getSession.mockRejectedValueOnce(new Error('network fail'));

    await useAuth.getState().init();

    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('signUp() calls authApi.signUp and sets user', async () => {
    const user = { id: '2', email: 'new@test.com', name: 'new' };
    mockAuthApi.signUp.mockResolvedValueOnce({ user });

    await useAuth.getState().signUp('new@test.com', 'pass');

    expect(mockAuthApi.signUp).toHaveBeenCalledWith('new@test.com', 'pass');
    expect(useAuth.getState().user).toEqual(user);
  });

  it('signIn() calls authApi.signIn and sets user', async () => {
    const user = { id: '3', email: 'ex@test.com', name: null };
    mockAuthApi.signIn.mockResolvedValueOnce({ user });

    await useAuth.getState().signIn('ex@test.com', 'secret');

    expect(mockAuthApi.signIn).toHaveBeenCalledWith('ex@test.com', 'secret');
    expect(useAuth.getState().user).toEqual(user);
  });

  it('signOut() calls authApi.signOut and clears user', async () => {
    useAuth.setState({ user: { id: '4', email: 'x@y.com', name: null }, loading: false });
    mockAuthApi.signOut.mockResolvedValueOnce(undefined);

    await useAuth.getState().signOut();

    expect(mockAuthApi.signOut).toHaveBeenCalled();
    expect(useAuth.getState().user).toBeNull();
  });
});
