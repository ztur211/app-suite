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
