import { render, fireEvent } from '@testing-library/react-native';
import { TextInput } from '../primitives/TextInput/TextInput';

describe('TextInput', () => {
  it('renders the placeholder', () => {
    const { getByPlaceholderText } = render(
      <TextInput value="" onChangeText={() => {}} placeholder="Email" />,
    );
    expect(getByPlaceholderText('Email')).toBeTruthy();
  });

  it('renders the current value', () => {
    const { getByDisplayValue } = render(
      <TextInput value="hello" onChangeText={() => {}} testID="t" />,
    );
    expect(getByDisplayValue('hello')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = render(
      <TextInput value="" onChangeText={onChangeText} testID="input" />,
    );
    fireEvent.changeText(getByTestId('input'), 'new value');
    expect(onChangeText).toHaveBeenCalledWith('new value');
  });

  it('calls onBlur when blurred', () => {
    const onBlur = jest.fn();
    const { getByTestId } = render(
      <TextInput value="" onChangeText={() => {}} onBlur={onBlur} testID="input" />,
    );
    fireEvent(getByTestId('input'), 'blur');
    expect(onBlur).toHaveBeenCalled();
  });

  it('forwards secureTextEntry', () => {
    const { getByTestId } = render(
      <TextInput value="" onChangeText={() => {}} secureTextEntry testID="pw" />,
    );
    expect(getByTestId('pw').props.secureTextEntry).toBe(true);
  });

  it('forwards keyboardType and autoCapitalize', () => {
    const { getByTestId } = render(
      <TextInput
        value=""
        onChangeText={() => {}}
        keyboardType="email-address"
        autoCapitalize="none"
        testID="email"
      />,
    );
    expect(getByTestId('email').props.keyboardType).toBe('email-address');
    expect(getByTestId('email').props.autoCapitalize).toBe('none');
  });

  it('renders an error message when error is a string', () => {
    const { getByText } = render(
      <TextInput value="" onChangeText={() => {}} error="Email is required" />,
    );
    expect(getByText('Email is required')).toBeTruthy();
  });

  it('does not render an error block when error is undefined', () => {
    const { queryByTestId } = render(<TextInput value="" onChangeText={() => {}} testID="input" />);
    expect(queryByTestId('input-error')).toBeNull();
  });

  it('renders the error block with the input testID + "-error" when error is set', () => {
    const { getByTestId } = render(
      <TextInput value="" onChangeText={() => {}} testID="input" error="Bad" />,
    );
    expect(getByTestId('input-error')).toBeTruthy();
  });

  it('calls onSubmitEditing when submit is fired', () => {
    const onSubmitEditing = jest.fn();
    const { getByTestId } = render(
      <TextInput
        value="ok"
        onChangeText={() => {}}
        onSubmitEditing={onSubmitEditing}
        testID="input"
      />,
    );
    fireEvent(getByTestId('input'), 'submitEditing');
    expect(onSubmitEditing).toHaveBeenCalled();
  });
});
