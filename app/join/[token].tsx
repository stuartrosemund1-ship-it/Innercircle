import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { clearPendingInvite, setPendingInvite } from '@/lib/pendingInvite';
import { colors, spacing, typography } from '@/constants/theme';

export default function JoinScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const inviteToken = typeof token === 'string' ? token : '';
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (inviteToken && !user) setPendingInvite(inviteToken);

  useEffect(() => {
    if (!user || !inviteToken) return;
    let cancelled = false;
    (async () => {
      try {
        await api.acceptInvitation(inviteToken, user.id);
        clearPendingInvite();
        if (!cancelled) router.replace('/(tabs)');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'This invite could not be accepted.');
      }
    })();
    return () => { cancelled = true; };
  }, [user, inviteToken, router]);

  if (!inviteToken) {
    return <Screen><Text style={styles.body}>This invite link is missing a token.</Text></Screen>;
  }
  if (!user) {
    return (
      <Screen>
        <Text style={styles.title}>You are invited</Text>
        <Text style={styles.body}>Sign in or create an account to join this circle. Accepting connects you with the person who invited you.</Text>
        <Button title="Sign in" onPress={() => router.push('/(auth)/sign-in')} />
        <Button title="Create account" variant="secondary" onPress={() => router.push('/(auth)/sign-up')} style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }
  if (!error) return <LoadingState label="Accepting invite…" />;
  return (
    <Screen>
      <Text style={styles.title}>Invite</Text>
      <Text style={styles.body}>{error ?? 'Opening your circle.'}</Text>
      {error ? <Button title="Back home" onPress={() => { clearPendingInvite(); router.replace('/(tabs)'); }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
});
