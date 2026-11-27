import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { jobMediaBadge, templateLabel } from '@/lib/jobMedia';
import type { JobMedia } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export function JobGallery({ professionalId, viewerId, isOwner }: { professionalId: string; viewerId: string; isOwner: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<JobMedia[]>([]);
  const [pending, setPending] = useState<JobMedia[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getState().then((state) => {
        if (cancelled) return;
        const mine = state.jobMedia.filter((item) => item.professional_id === professionalId);
        const requests = state.serviceRequests;
        setItems(mine.filter((item) => item.consent_status === 'approved'));
        setPending(mine.filter((item) => item.consent_status === 'pending' && requests.some((request) => request.id === item.service_request_id && request.member_id === viewerId)));
      });
    };
    load();
    const unsubscribe = api.subscribe(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [professionalId, viewerId]);
  if (items.length === 0 && pending.length === 0 && !isOwner) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Completed jobs</Text>
      {items.length === 0 ? <Text style={styles.muted}>No public jobs yet. A verified job needs a completed booking and the customer’s agreement.</Text> : (
        <View style={styles.grid}>
          {items.map((item) => (
            <Pressable key={item.id} style={styles.tile} onPress={() => router.push(`/job-media/${item.id}`)}>
              <Text style={styles.badge}>{jobMediaBadge(item)}</Text>
              <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.muted}>{templateLabel(item.template)}{item.kind === 'video' ? ' · Video' : ''}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {pending.map((item) => (
        <View key={item.id} style={styles.pending}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.muted}>The professional wants this on their profile. It stays private until you agree.</Text>
          <View style={styles.row}>
            <Pressable onPress={() => api.consentJobMedia(viewerId, item.id, true).catch((error) => Alert.alert('Could not approve', error instanceof Error ? error.message : 'Try again'))}><Text style={styles.link}>Approve</Text></Pressable>
            <Pressable onPress={() => api.consentJobMedia(viewerId, item.id, false).catch((error) => Alert.alert('Could not hide', error instanceof Error ? error.message : 'Try again'))}><Text style={styles.link}>Keep private</Text></Pressable>
          </View>
        </View>
      ))}
      {isOwner ? <Pressable onPress={() => router.push({ pathname: '/add-job-media', params: { professionalId } })}><Text style={styles.link}>Add a completed job</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: spacing.sm },
  label: { ...typography.label, color: colors.text.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48%', flexGrow: 1, minHeight: 110, backgroundColor: colors.brand.purpleSoft, borderRadius: radii.md, padding: spacing.sm, justifyContent: 'flex-end' },
  badge: { ...typography.caption, color: colors.brand.teal, marginBottom: spacing.xs },
  title: { ...typography.bodyMedium, color: colors.text.primary },
  muted: { ...typography.caption, color: colors.text.secondary },
  pending: { backgroundColor: colors.demo.banner, borderRadius: radii.md, padding: spacing.md, gap: 4 },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  link: { ...typography.label, color: colors.brand.purple },
});
