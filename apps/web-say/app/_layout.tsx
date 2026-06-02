import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../store/auth.store';
import { ThemeProvider, tokens } from '@things/design-system';

export default function RootLayout() {
  const { loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) return null;

  return (
    <ThemeProvider accent={tokens.colors.apps.say}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
