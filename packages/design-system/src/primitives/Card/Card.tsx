import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '../../tokens';

const cardBaseStyle: ViewStyle = {
  backgroundColor: tokens.colors.surface.raised,
  borderRadius: tokens.radius.xl,
  padding: tokens.space[4],
  ...tokens.shadow.md,
};

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressable?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Card({ children, style, pressable, onPress, testID }: CardProps) {
  if (pressable && onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={[cardBaseStyle, style]}>
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[cardBaseStyle, style]}>
      {children}
    </View>
  );
}
