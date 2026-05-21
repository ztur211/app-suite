import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { tokens } from '../../tokens';
import { usePressFeedback } from '../../animation/usePressFeedback';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', style, testID }: ButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();

  const containerStyle = {
    primary: {
      backgroundColor: tokens.colors.brand.coral,
      borderRadius: tokens.radius.lg,
      paddingVertical: tokens.space[3],
      paddingHorizontal: tokens.space[6],
      alignItems: 'center' as const,
    },
    secondary: {
      backgroundColor: 'transparent',
      borderRadius: tokens.radius.lg,
      paddingVertical: tokens.space[3],
      paddingHorizontal: tokens.space[6],
      borderWidth: 1.5,
      borderColor: tokens.colors.brand.coral,
      alignItems: 'center' as const,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderRadius: tokens.radius.lg,
      paddingVertical: tokens.space[3],
      paddingHorizontal: tokens.space[6],
      alignItems: 'center' as const,
    },
  }[variant];

  const textStyle = {
    primary: {
      color: tokens.colors.surface.canvas,
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold,
    },
    secondary: {
      color: tokens.colors.brand.coral,
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.semibold,
    },
    ghost: {
      color: tokens.colors.ink[700],
      fontSize: tokens.typography.fontSize.base,
      fontWeight: tokens.typography.fontWeight.medium,
    },
  }[variant];

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[animatedStyle, containerStyle, style]}
    >
      <Text style={textStyle}>{label}</Text>
    </AnimatedPressable>
  );
}
