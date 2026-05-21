import { render } from '@testing-library/react-native';
import Index from '../app/index';

describe('web-eat Index screen', () => {
  it('renders the "Eat Things" wordmark', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Eat Things')).toBeTruthy();
  });
});
