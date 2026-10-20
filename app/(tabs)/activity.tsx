import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { useCircleData } from '@/hooks/useCircleData';
import { api } from '@/lib/api';
import type { Connection, Profile } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function ActivityScreen() {
  const { user } = useAuth();
  const data = useCircleData();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  useEffect(() => {
    if (!user) return;
    (async () => {
      const state = await api.getState();
      const map: Record<string, Profile> = {};
      for (const p of state.profiles) map[p.id] = p;
      setProfiles(map);
    })();
  }, [user, data.connections, data.notifications]);
  if (!user) return null;
  if (data.loading) return <LoadingState />;
  async function respond(conn: Connection, accept: boolean) {
    try { await api.respondConnection(conn.id, user!.id, accept); await data.refresh(); }
    catch (e) { Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again'); }
  }
  const pendingIntros = data.introductions.filter((i) => i.status === 'pending' && i.intermediary_id === user.id);
  return (
    <Screen scroll onRefresh={data.refresh}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Activity</Text>
        <Button title="Mark all read" variant="ghost" onPress={async () => { await api.markAllNotificationsRead(user.id); await data.refresh(); }} />
      </View>
      <Text style={styles.section}>Connection requests</Text>
      {data.pendingIncoming.length === 0 ? <Text style={styles.muted}>No pending connection requests.</Text> : data.pendingIncoming.map((c) => (
        <View key={c.id} style={styles.card}>
          <Text style={styles.cardTitle}>{profiles[c.requester_id]?.full_name ?? 'Someone'} wants to connect</Text>
          <View style={styles.rowActions}>
            <Button title="Accept" variant="teal" onPress={() => respond(c, true)} style={{ flex: 1 }} />
            <Button title="Decline" variant="secondary" onPress={() => respond(c, false)} style={{ flex: 1 }} />
          </View>
        </View>
      ))}
      <Text style={styles.section}>Introduction requests</Text>
      {pendingIntros.length === 0 ? <Text style={styles.muted}>No pending introductions to review.</Text> : pendingIntros.map((i) => (
        <Pressable key={i.id} style={styles.card} onPress={() => router.push(`/intro/${i.id}`)}>
          <Text style={styles.cardTitle}>{profiles[i.requester_id]?.full_name ?? 'Someone'} asked for an introduction</Text>
        </Pressable>
      ))}
      <Text style={styles.section}>Notifications</Text>
      {data.notifications.length === 0 ? <EmptyState title="You're all caught up" description="Updates will appear here." /> : data.notifications.map((n) => (
        <Pressable key={n.id} style={[styles.card, !n.read_at && styles.unread]} onPress={async () => {
          await api.markNotificationRead(n.id, user.id);
          if ((n.type === 'introduction_request' || n.type === 'introduction_accepted') && n.reference_id) router.push(`/intro/${n.reference_id}`);
          else if (n.type === 'message' && n.reference_id) router.push(`/messages/${n.reference_id}`);
          else await data.refresh();
        }}>
          <Text style={styles.cardTitle}>{n.title}</Text>
          <Text style={styles.cardBody}>{n.body}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.text.primary },
  section: { ...typography.h3, color: colors.text.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  muted: { ...typography.caption, color: colors.text.muted },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.surface.border },
  unread: { borderColor: colors.brand.purple, backgroundColor: colors.brand.purpleSoft },
  cardTitle: { ...typography.bodyMedium, color: colors.text.primary },
  cardBody: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  rowActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
