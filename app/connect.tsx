import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Profile } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';
export default function ConnectScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [people, setPeople] = useState<Profile[]>([]);
  useEffect(() => {
    if (!user) return;
    api.getState().then(async (state) => {
      const conns = await api.listConnections(user.id);
      const linked = new Set<string>();
      for (const c of conns) { linked.add(c.requester_id); linked.add(c.recipient_id); }
      setPeople(state.profiles.filter((p) => p.id !== user.id && !linked.has(p.id)));
    });
  }, [user]);
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Send a connection request</Text>
      {people.map((p) => (
        <Pressable key={p.id} style={styles.row} onPress={async () => {
          try { await api.requestConnection(user.id, p.id); Alert.alert('Request sent'); router.back(); }
          catch (e) { Alert.alert('Error', e instanceof Error ? e.message : 'Try again'); }
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
  row: { padding: spacing.md, backgroundColor: colors.surface.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.sm },
  rowTitle: { ...typography.bodyMedium, color: colors.text.primary },
  rowSub: { ...typography.caption, color: colors.text.secondary },
});
