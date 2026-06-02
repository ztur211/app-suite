import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../store/auth.store';

export default function AuthLayout() {
  const { user } = useAuth();
  if (user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
