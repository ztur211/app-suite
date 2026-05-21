import { createContext, useContext, type ReactNode } from 'react';
import { tokens, type AppAccentColor } from '../tokens';

export interface ThemeContextValue {
  tokens: typeof tokens;
  accent: AppAccentColor;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  accent: AppAccentColor;
  children: ReactNode;
}

export function ThemeProvider({ accent, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={{ tokens, accent }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a <ThemeProvider>');
  }
  return ctx;
}
