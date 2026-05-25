import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../store/auth.store';

export default function AppLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
