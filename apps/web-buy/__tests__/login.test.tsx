import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import Login from '../app/(auth)/login';
import { useAuth } from '@things/web-kit';

jest.mock('@things/web-kit', () => ({
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
  it('renders the Buy Things wordmark', () => {
    const { getByText } = render(<Login />);
    expect(getByText('Buy Things')).toBeTruthy();
  });

  it('renders email and password inputs', () => {
    const { getByTestId } = render(<Login />);
    expect(getByTestId('login-email')).toBeTruthy();
    expect(getByTestId('login-password')).toBeTruthy();
  });

  it('toggles to Create account mode on toggle press', () => {
    const { getByText } = render(<Login />);
    fireEvent.press(getByText("Don't have an account? Sign up"));
    expect(getByText('Create account')).toBeTruthy();
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

  it('shows error message on sign in failure', async () => {
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

  it('blocks submit on invalid email', async () => {
    const { getByTestId, findByText } = render(<Login />);
    fireEvent.changeText(getByTestId('login-email'), 'not-email');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(await findByText('Enter a valid email')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
