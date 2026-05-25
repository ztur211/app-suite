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
  it('renders email and password inputs', () => {
    const { getByTestId } = render(<Login />);
    expect(getByTestId('login-email')).toBeTruthy();
    expect(getByTestId('login-password')).toBeTruthy();
  });

  it('renders the Sign in heading by default', () => {
    const { getAllByText } = render(<Login />);
    // Both a heading and a button have "Sign in" text
    expect(getAllByText('Sign in').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Do Things wordmark', () => {
    const { getByText } = render(<Login />);
    expect(getByText('Do Things')).toBeTruthy();
  });

  it('shows the toggle to sign up', () => {
    const { getByText } = render(<Login />);
    expect(getByText("Don't have an account? Sign up")).toBeTruthy();
  });

  it('toggles to Create account mode on toggle press', () => {
    const { getByText } = render(<Login />);
    fireEvent.press(getByText("Don't have an account? Sign up"));
    expect(getByText('Create account')).toBeTruthy();
    expect(getByText('Have an account? Sign in')).toBeTruthy();
  });

  it('calls signIn with email and password on submit in signin mode', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    const { getByTestId } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'test@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });

    expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('calls signUp in signup mode', async () => {
    mockSignUp.mockResolvedValueOnce(undefined);
    const { getByTestId, getByText } = render(<Login />);

    // Toggle to signup
    fireEvent.press(getByText("Don't have an account? Sign up"));
    fireEvent.changeText(getByTestId('login-email'), 'new@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'secret123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });

    expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'secret123');
  });

  it('shows error message on sign in failure', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid credentials'));
    const { getByTestId, findByText } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'bad@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'wrongpass1');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });

    await waitFor(async () => {
      expect(await findByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('shows inline error and does not submit when email is invalid', async () => {
    const { getByTestId, findByText } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'not-an-email');
    fireEvent.changeText(getByTestId('login-password'), 'password123');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });

    expect(await findByText('Enter a valid email')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows inline error and does not submit when password is too short', async () => {
    const { getByTestId, findByText } = render(<Login />);

    fireEvent.changeText(getByTestId('login-email'), 'ok@example.com');
    fireEvent.changeText(getByTestId('login-password'), 'short');
    await act(async () => {
      fireEvent.press(getByTestId('login-submit'));
    });

    expect(await findByText('Password must be at least 8 characters')).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
