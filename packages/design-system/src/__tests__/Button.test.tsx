import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../primitives/Button/Button';

describe('Button', () => {
  it('renders the label text', () => {
    const { getByText } = render(<Button label="Add task" onPress={() => {}} />);
    expect(getByText('Add task')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Press me" onPress={onPress} />);
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders with primary variant by default', () => {
    const { getByTestId } = render(<Button label="Primary" onPress={() => {}} testID="btn" />);
    expect(getByTestId('btn')).toBeTruthy();
  });

  it('renders with secondary variant', () => {
    const { getByTestId } = render(
      <Button label="Secondary" onPress={() => {}} variant="secondary" testID="btn-sec" />,
    );
    expect(getByTestId('btn-sec')).toBeTruthy();
  });

  it('renders with ghost variant', () => {
    const { getByTestId } = render(
      <Button label="Ghost" onPress={() => {}} variant="ghost" testID="btn-ghost" />,
    );
    expect(getByTestId('btn-ghost')).toBeTruthy();
  });
});
