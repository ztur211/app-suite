import { render } from '@testing-library/react-native';
import Index from '../app/index';

describe('web-buy Index screen', () => {
  it('renders the "Buy Things" wordmark', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Buy Things')).toBeTruthy();
  });
});
