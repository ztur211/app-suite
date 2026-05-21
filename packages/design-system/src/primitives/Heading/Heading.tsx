import { Text, type TextStyle, type StyleProp } from 'react-native';
import { tokens } from '../../tokens';

export type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps {
  level: HeadingLevel;
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

const levelStyleMap: Record<HeadingLevel, TextStyle> = {
  1: {
    fontSize: tokens.typography.fontSize['4xl'],
    lineHeight: tokens.typography.lineHeight['4xl'],
    fontWeight: tokens.typography.fontWeight.black,
    color: tokens.colors.ink[900],
    letterSpacing: tokens.typography.letterSpacing.tight,
  },
  2: {
    fontSize: tokens.typography.fontSize['3xl'],
    lineHeight: tokens.typography.lineHeight['3xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.ink[900],
    letterSpacing: tokens.typography.letterSpacing.tight,
  },
  3: {
    fontSize: tokens.typography.fontSize['2xl'],
    lineHeight: tokens.typography.lineHeight['2xl'],
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.ink[900],
  },
  4: {
    fontSize: tokens.typography.fontSize.xl,
    lineHeight: tokens.typography.lineHeight.xl,
    fontWeight: tokens.typography.fontWeight.semibold,
    color: tokens.colors.ink[900],
  },
};

export function Heading({ level, children, style, testID }: HeadingProps) {
  return (
    <Text accessibilityRole="header" testID={testID} style={[levelStyleMap[level], style]}>
      {children}
    </Text>
  );
}
