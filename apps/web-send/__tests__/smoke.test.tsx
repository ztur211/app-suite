import { render } from '@testing-library/react-native';
import Index from '../app/index';

describe('web-send Index screen', () => {
  it('renders the "Send Things" wordmark', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Send Things')).toBeTruthy();
  });
});
