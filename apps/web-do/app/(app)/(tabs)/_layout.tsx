import { Tabs } from 'expo-router';
import { tokens } from '@things/design-system';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tokens.colors.apps.do,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    </Tabs>
  );
}
