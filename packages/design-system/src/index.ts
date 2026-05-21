export const PACKAGE_NAME = '@things/design-system' as const;

// Tokens
export {
  colors,
  typography,
  space,
  radius,
  shadow,
  motion,
  tokens,
  type AppAccent,
  type AppAccentColor,
  type Tokens,
} from './tokens';

// Theme
export {
  ThemeProvider,
  useTheme,
  type ThemeContextValue,
  type ThemeProviderProps,
} from './theme/ThemeProvider';

// Primitives
export { Heading, type HeadingProps, type HeadingLevel } from './primitives/Heading/Heading';
export { Button, type ButtonProps, type ButtonVariant } from './primitives/Button/Button';
export { Card, type CardProps } from './primitives/Card/Card';

// Animation hooks
export { usePressFeedback } from './animation/usePressFeedback';
