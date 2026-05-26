import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Login from '../app/(auth)/login';
import { useAuth } from '../store/auth.store';

jest.mock('../store/auth.store', () => ({
  useAuth: jest.fn(),
}));

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({
    signIn: mockSignIn,
    signUp: mockSignUp,
  });
});

describe('Login screen', () => {
  it('renders the Send Things wordmark', () => {
    const { getByText } = render(<Login />);
    expect(getByText('Send Things')).toBeTruthy();
  });

  it('calls signIn on submit', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<Login />);
    fireEvent.changeText(getByTestId('login-email'), 'a@b.com');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(mockSignIn).toHaveBeenCalledWith('a@b.com', 'password123');
  });

  it('shows error on bad credentials', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { getByTestId, findByText } = render(<Login />);
    fireEvent.changeText(getByTestId('login-email'), 'bad@b.com');
    fireEvent.changeText(getByTestId('login-password'), 'wrongpass');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    await waitFor(async () => {
      expect(await findByText('Invalid credentials')).toBeTruthy();
    });
  });
});
