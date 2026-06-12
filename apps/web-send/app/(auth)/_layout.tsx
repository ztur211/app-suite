import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@things/web-kit';

export default function AuthLayout() {
  const { user } = useAuth();
  if (user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
