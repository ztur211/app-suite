import { render } from '@testing-library/react-native';
import Index from '../app/index';

describe('web-do Index screen', () => {
  it('renders the "Do Things" wordmark', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Do Things')).toBeTruthy();
  });
});
