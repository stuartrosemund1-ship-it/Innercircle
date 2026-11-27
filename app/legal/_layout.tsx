import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function LegalLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.brand.purple, contentStyle: { backgroundColor: colors.surface.background } }}>
      <Stack.Screen name="privacy-policy" options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of Use' }} />
    </Stack>
  );
}
