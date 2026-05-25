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
  useAuth.setState({ user: null, loading: true });
  jest.clearAllMocks();
});

describe('useAuth store', () => {
  it('init() sets user from session', async () => {
    const session = { user: { id: '1', email: 'a@b.com', name: 'a' } };
    mockAuthApi.getSession.mockResolvedValueOnce(session);
    await useAuth.getState().init();
    expect(useAuth.getState().user).toEqual(session.user);
    expect(useAuth.getState().loading).toBe(false);
  });

  it('init() sets user: null on error', async () => {
    mockAuthApi.getSession.mockRejectedValueOnce(new Error('net'));
    await useAuth.getState().init();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().loading).toBe(false);
  });

  it('signIn() sets user', async () => {
    const user = { id: '3', email: 'ex@test.com', name: null };
    mockAuthApi.signIn.mockResolvedValueOnce({ user });
    await useAuth.getState().signIn('ex@test.com', 'secret123');
    expect(useAuth.getState().user).toEqual(user);
  });

  it('signOut() clears user', async () => {
    useAuth.setState({ user: { id: '4', email: 'x@y.com', name: null }, loading: false });
    mockAuthApi.signOut.mockResolvedValueOnce(undefined);
    await useAuth.getState().signOut();
    expect(useAuth.getState().user).toBeNull();
  });
});
