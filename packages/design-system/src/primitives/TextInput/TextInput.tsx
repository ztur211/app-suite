import {
  TextInput as RNTextInput,
  View,
  Text,
  type StyleProp,
  type ViewStyle,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { tokens } from '../../tokens';

export interface TextInputProps extends Omit<RNTextInputProps, 'value' | 'onChangeText' | 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: RNTextInputProps['style'];
  testID?: string;
}

export function TextInput({
  value,
  onChangeText,
  error,
  containerStyle,
  inputStyle,
  testID,
  ...rest
}: TextInputProps) {
  const borderColor = error ? tokens.colors.semantic.danger : tokens.colors.ink[200];

  return (
    <View style={containerStyle}>
      <RNTextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={tokens.colors.ink[500]}
        style={[
          {
            borderWidth: 1,
            borderColor,
            borderRadius: tokens.radius.md,
            paddingVertical: tokens.space[3],
            paddingHorizontal: tokens.space[3],
            fontSize: tokens.typography.fontSize.base,
            color: tokens.colors.ink[900],
            backgroundColor: tokens.colors.surface.canvas,
          },
          inputStyle,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          style={{
            marginTop: tokens.space[1],
            color: tokens.colors.semantic.danger,
            fontSize: tokens.typography.fontSize.sm,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
