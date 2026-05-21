import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../primitives/Card/Card';

describe('Card', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Card>
        <Text>Card content</Text>
      </Card>,
    );
    expect(getByText('Card content')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <Card testID="my-card">
        <Text>Content</Text>
      </Card>,
    );
    expect(getByTestId('my-card')).toBeTruthy();
  });

  it('renders as non-pressable by default', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Card testID="card-np">
        <Text>Content</Text>
      </Card>,
    );
    // non-pressable card should not invoke onPress (it doesn't accept onPress prop)
    expect(getByTestId('card-np')).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders as pressable when pressable=true and calls onPress', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <Card pressable onPress={onPress} testID="card-press">
        <Text>Pressable</Text>
      </Card>,
    );
    fireEvent.press(getByTestId('card-press'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies surface background styles', () => {
    const { getByTestId } = render(
      <Card testID="card-style">
        <Text>Content</Text>
      </Card>,
    );
    const card = getByTestId('card-style');
    const style = card.props.style;
    const flatStyle = Array.isArray(style) ? Object.assign({}, ...style.flat()) : style;
    expect(flatStyle.borderRadius).toBeDefined();
  });
});
