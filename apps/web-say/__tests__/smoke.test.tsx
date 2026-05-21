import { render } from '@testing-library/react-native';
import Index from '../app/index';

describe('web-say Index screen', () => {
  it('renders the "Say Things" wordmark', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Say Things')).toBeTruthy();
  });
});
