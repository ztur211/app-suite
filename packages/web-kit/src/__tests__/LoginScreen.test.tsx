import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../LoginScreen';
import { useAuth } from '../auth-store';

jest.mock('../auth-store', () => ({
  useAuth: jest.fn(),
}));

const mockSignIn = jest.fn();
const mockSignUp = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as unknown as jest.Mock).mockReturnValue({
    signIn: mockSignIn,
    signUp: mockSignUp,
  });
});

describe('LoginScreen', () => {
  it('renders email and password inputs', () => {
    const { getByTestId } = render(<LoginScreen appName="Do Things" />);
    expect(getByTestId('login-email')).toBeTruthy();
    expect(getByTestId('login-password')).toBeTruthy();
  });

  it('renders the provided appName as the wordmark', () => {
    const { getByText } = render(<LoginScreen appName="Buy Things" />);
    expect(getByText('Buy Things')).toBeTruthy();
  });

  it('renders the Sign in heading by default', () => {
    const { getAllByText } = render(<LoginScreen appName="Do Things" />);
    expect(getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles to Create account mode on toggle press', () => {
    const { getByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.press(getByText("Don't have an account? Sign up"));
    expect(getByText('Create account')).toBeTruthy();
    expect(getByText('Have an account? Sign in')).toBeTruthy();
  });

  it('calls signIn with email and password on submit', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'test@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('calls signUp in signup mode', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const { getByTestId, getByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.press(getByText("Don't have an account? Sign up"));
    fireEvent.changeText(getByTestId('login-email'), 'new@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'secret123');
  });

  it('shows the error message on sign in failure', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { getByTestId, findByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'bad@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'wrongpass1');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    await waitFor(async () => {
      expect(await findByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('blocks submit and shows an inline error for an invalid email', async () => {
    const { getByTestId, findByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'not-an-email');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(await findByText('Enter a valid email')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('blocks submit and shows an inline error for a short password', async () => {
    const { getByTestId, findByText } = render(<LoginScreen appName="Do Things" />);
    fireEvent.changeText(getByTestId('login-email'), 'ok@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'short');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });
    expect(await findByText('Password must be at least 8 characters')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
