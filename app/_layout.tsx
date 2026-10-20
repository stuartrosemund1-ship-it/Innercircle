import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, useFonts } from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';
import { LoadingState } from '@/components/ui/LoadingState';

export { ErrorBoundary } from 'expo-router';
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    if (!user && !inAuth) { router.replace('/(auth)/welcome'); return; }
    if (user && inAuth) {
      router.replace(!user.onboarding_completed ? '/onboarding' : '/(tabs)');
      return;
    }
    if (user && !user.onboarding_completed && !inOnboarding && !inAuth) router.replace('/onboarding');
  }, [user, loading, segments, router]);
  if (loading) return <LoadingState label="Opening LifeCircle…" />;
  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
  if (!loaded) return null;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: colors.brand.purple, headerTitleStyle: { fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.text.primary }, contentStyle: { backgroundColor: colors.surface.background } }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
          <Stack.Screen name="person/[id]" options={{ title: 'Person' }} />
          <Stack.Screen name="professional/[id]" options={{ title: 'Professional' }} />
          <Stack.Screen name="intro/[id]" options={{ title: 'Introduction' }} />
          <Stack.Screen name="messages/[id]" options={{ title: 'Messages' }} />
          <Stack.Screen name="add-person" options={{ title: 'Add a person', presentation: 'modal' }} />
          <Stack.Screen name="add-professional" options={{ title: 'Add a professional', presentation: 'modal' }} />
          <Stack.Screen name="invite" options={{ title: 'Invite a friend', presentation: 'modal' }} />
          <Stack.Screen name="recommend" options={{ title: 'Recommend', presentation: 'modal' }} />
          <Stack.Screen name="request-intro" options={{ title: 'Request introduction', presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit profile', presentation: 'modal' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
          <Stack.Screen name="connect" options={{ title: 'Connect', presentation: 'modal' }} />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
