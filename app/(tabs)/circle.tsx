import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { CircleGraph } from '@/components/circle/CircleGraph';
import { useAuth } from '@/contexts/AuthContext';
import { useCircleData } from '@/hooks/useCircleData';
import { applicationStatusLabel, isApprovedProfessional, isVerifiedProfessional } from '@/lib/application';
import { PriceRange } from '@/components/ui/PriceRange';
import { colors, radii, spacing, typography } from '@/constants/theme';
import type { TrustLabel } from '@/types';

type Mode = 'people' | 'professionals' | 'shared';
type ViewMode = 'circle' | 'list';

export default function CircleScreen() {
  const { user } = useAuth();
  const data = useCircleData();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('people');
  const [view, setView] = useState<ViewMode>('circle');
  const sharedPros = useMemo(() => {
    if (!user) return [];
    const counts = new Map<string, Set<string>>();
    for (const r of data.recommendations) {
      if (r.recommender_id === user.id || r.status !== 'active') continue;
      if (!data.people.some((p) => p.id === r.recommender_id)) continue;
      const set = counts.get(r.professional_id) ?? new Set();
      set.add(r.recommender_id);
      counts.set(r.professional_id, set);
    }
    return data.professionals.filter((p) => isApprovedProfessional(p) && (counts.get(p.id)?.size ?? 0) >= 2);
  }, [data.recommendations, data.professionals, data.people, user]);
  if (!user) return null;
  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error} onRetry={data.refresh} />;
  function trustLabelFor(professionalId: string): TrustLabel {
    if (data.personalTrusts.some((t) => t.professional_id === professionalId)) return 'personally_trusted';
    if (data.introductions.some((i) => i.professional_id === professionalId && i.requester_id === user!.id && i.status === 'accepted')) return 'introduced';
    return 'recommended';
  }
  const visiblePros = data.professionals.filter((p) => isApprovedProfessional(p) || p.created_by === user.id || p.owner_user_id === user.id);
  const graphPros = mode === 'shared' ? sharedPros : visiblePros.filter((p) => isApprovedProfessional(p) && (
    data.personalTrusts.some((t) => t.professional_id === p.id) ||
    data.recommendations.some((r) => r.professional_id === p.id && r.recommender_id === user.id)
  ));
  return (
    <Screen scroll onRefresh={data.refresh}>
      <Text style={styles.title}>My Circle</Text>
      <Text style={styles.sub}>People you trust, and professionals you have chosen yourself.</Text>
      <View style={styles.segment}>
        {(['people', 'professionals', 'shared'] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segBtnActive]}>
            <Text style={[styles.segText, mode === m && styles.segTextActive]}>{m === 'people' ? 'People' : m === 'professionals' ? 'Professionals' : 'Shared'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.viewToggle}>
        <Pressable onPress={() => setView('circle')} style={[styles.viewBtn, view === 'circle' && styles.viewBtnActive]}><Text style={styles.viewText}>Circle</Text></Pressable>
        <Pressable onPress={() => setView('list')} style={[styles.viewBtn, view === 'list' && styles.viewBtnActive]}><Text style={styles.viewText}>List</Text></Pressable>
      </View>
      {view === 'circle' ? (
        <CircleGraph me={user} people={data.people} professionals={graphPros} mode={mode === 'people' ? 'people' : 'professionals'} onSelectPerson={(id) => router.push(`/person/${id}`)} onSelectProfessional={(id) => router.push(`/professional/${id}`)} />
      ) : null}
      {(view === 'list' || mode === 'shared') && (
        mode === 'people' ? (
          data.people.length === 0 ? <EmptyState title="No people yet" description="Invite a friend or accept a connection to grow your circle." actionLabel="Invite a Friend" onAction={() => router.push('/invite')} />
          : data.people.map((p) => (
            <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/person/${p.id}`)}>
              <Avatar name={p.full_name} uri={p.avatar_url} />
              <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{p.full_name}</Text><Text style={styles.rowSub}>{p.city ?? 'Connected'}</Text></View>
            </Pressable>
          ))
        ) : mode === 'shared' ? (
          sharedPros.length === 0 ? <EmptyState title="No shared connections yet" description="Shared professionals appear only when more than one person in your circle recommends the same professional." />
          : sharedPros.map((p) => (
            <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/professional/${p.id}`)}>
              <Avatar name={p.name} uri={p.avatar_url} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.titleLine}><Text style={styles.rowTitle}>{p.name}</Text>{isVerifiedProfessional(p) ? <VerifiedBadge /> : null}</View>
                <PriceRange professional={p} />
                <TrustBadge label={trustLabelFor(p.id)} />
              </View>
            </Pressable>
          ))
        ) : visiblePros.length === 0 ? <EmptyState title="No professionals in view" description="Apply as a professional, or wait for an approved recommendation from your circle." actionLabel="Apply as a professional" onAction={() => router.push('/add-professional')} />
          : visiblePros.map((p) => (
            <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/professional/${p.id}`)}>
              <Avatar name={p.name} uri={p.avatar_url} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.titleLine}><Text style={styles.rowTitle}>{p.name}</Text>{isVerifiedProfessional(p) ? <VerifiedBadge /> : null}</View>
                <Text style={styles.rowSub}>{p.category}</Text>
                {isApprovedProfessional(p) ? <PriceRange professional={p} /> : <Text style={styles.rowSub}>{applicationStatusLabel(p.application_status)}</Text>}
                {isApprovedProfessional(p) ? <TrustBadge label={trustLabelFor(p.id)} /> : null}
              </View>
            </Pressable>
          ))
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  segment: { flexDirection: 'row', backgroundColor: colors.surface.muted, borderRadius: radii.full, padding: 4, marginBottom: spacing.sm },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radii.full },
  segBtnActive: { backgroundColor: colors.surface.card },
  segText: { ...typography.label, color: colors.text.muted },
  segTextActive: { color: colors.brand.purple },
  viewToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.surface.muted },
  viewBtnActive: { backgroundColor: colors.brand.purpleSoft },
  viewText: { ...typography.label, color: colors.text.secondary },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.surface.border },
  titleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  rowTitle: { ...typography.bodyMedium, color: colors.text.primary },
  rowSub: { ...typography.caption, color: colors.text.secondary },
});
