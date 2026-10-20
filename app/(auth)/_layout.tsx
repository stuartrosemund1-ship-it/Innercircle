import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.brand.purple, contentStyle: { backgroundColor: colors.surface.background } }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}
