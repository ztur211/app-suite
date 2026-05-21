import { render } from '@testing-library/react-native';
import Index from '../app/index';

describe('web-do Index screen', () => {
  it('renders the Do Things wordmark', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Do Things')).toBeTruthy();
  });
  it('renders the Today card heading', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Today')).toBeTruthy();
  });
  it('renders the Add task button', () => {
    const { getByText } = render(<Index />);
    expect(getByText('Add task')).toBeTruthy();
  });
});
