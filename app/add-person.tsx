import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Profile } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';
export default function AddPersonScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  useEffect(() => {
    if (!user) return;
    api.getState().then((state) => setCandidates(state.profiles.filter((p) => p.id !== user.id)));
  }, [user]);
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Add a person</Text>
      <TextField label="Their email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Button title="Send connection request" onPress={async () => {
        const normalized = email.trim().toLowerCase();
        const match = candidates.find((p) => p.email === normalized) ?? await api.findProfileByEmail(normalized);
        if (!match) { Alert.alert('No account found', 'Invite them with a shareable link instead.'); return; }
        try { await api.requestConnection(user.id, match.id); Alert.alert('Request sent'); router.back(); }
        catch (e) { Alert.alert('Could not connect', e instanceof Error ? e.message : 'Try again'); }
      }} disabled={!email} />
      <Button title="Invite by link" variant="secondary" onPress={() => router.push('/invite')} style={{ marginTop: spacing.sm }} />
      {candidates.map((p) => (
        <Pressable key={p.id} style={styles.row} onPress={async () => {
          try { await api.requestConnection(user.id, p.id); Alert.alert('Request sent'); router.back(); }
          catch (e) { Alert.alert('Could not connect', e instanceof Error ? e.message : 'Try again'); }
        }}>
          <Text style={styles.rowTitle}>{p.full_name}</Text>
          <Text style={styles.rowSub}>{p.email}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.md },
  row: { padding: spacing.md, backgroundColor: colors.surface.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.sm, marginTop: spacing.sm },
  rowTitle: { ...typography.bodyMedium, color: colors.text.primary },
  rowSub: { ...typography.caption, color: colors.text.secondary },
});
