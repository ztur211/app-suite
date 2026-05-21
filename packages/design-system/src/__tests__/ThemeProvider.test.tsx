import { render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { tokens } from '../tokens';
import type { AppAccentColor } from '../tokens';

// A helper component that reads from context and renders the accent value
function AccentDisplay() {
  const theme = useTheme();
  return createElement(Text, { testID: 'accent' }, theme.accent);
}

// A helper that throws when used outside provider
function ThrowOutsideProvider() {
  useTheme();
  return null;
}

describe('ThemeProvider', () => {
  const accent: AppAccentColor = tokens.colors.apps.do;

  it('renders children', () => {
    const { getByTestId } = render(
      createElement(ThemeProvider, { accent }, createElement(Text, { testID: 'child' }, 'hello')),
    );
    expect(getByTestId('child')).toBeTruthy();
  });

  it('provides accent value via useTheme', () => {
    const { getByTestId } = render(
      createElement(ThemeProvider, { accent }, createElement(AccentDisplay, null)),
    );
    expect(getByTestId('accent').props.children).toBe(accent);
  });

  it('provides full tokens bundle via useTheme', () => {
    let capturedTokens: typeof tokens | undefined;

    function TokenCapture() {
      const theme = useTheme();
      capturedTokens = theme.tokens;
      return null;
    }

    render(createElement(ThemeProvider, { accent }, createElement(TokenCapture, null)));
    expect(capturedTokens).toBe(tokens);
  });

  it('passes different accent colors correctly', () => {
    const sayAccent: AppAccentColor = tokens.colors.apps.say;

    function SayAccentDisplay() {
      const theme = useTheme();
      return createElement(Text, { testID: 'say-accent' }, theme.accent);
    }

    const { getByTestId } = render(
      createElement(ThemeProvider, { accent: sayAccent }, createElement(SayAccentDisplay, null)),
    );
    expect(getByTestId('say-accent').props.children).toBe(sayAccent);
  });

  it('throws when useTheme is called outside a ThemeProvider', () => {
    // Suppress the expected React error boundary console.error
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(createElement(ThrowOutsideProvider, null))).toThrow(
      'useTheme must be used inside a <ThemeProvider>',
    );
    spy.mockRestore();
  });
});
