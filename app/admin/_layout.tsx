import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.brand.purple, contentStyle: { backgroundColor: colors.surface.background } }}>
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="[id]" options={{ title: 'Application' }} />
    </Stack>
  );
}
