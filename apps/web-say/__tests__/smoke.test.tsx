import { render } from '@testing-library/react-native';
import Login from '../app/(auth)/login';

describe('web-say login screen', () => {
  it('renders the "Say Things" wordmark and a submit button', () => {
    const { getByText, getByTestId } = render(<Login />);
    expect(getByText('Say Things')).toBeTruthy();
    expect(getByTestId('login-submit')).toBeTruthy();
  });
});
