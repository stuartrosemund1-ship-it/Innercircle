import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Professional, Profile, ProfessionalRecommendation } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recs, setRecs] = useState<{ rec: ProfessionalRecommendation; pro: Professional }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const state = await api.getState();
      const person = state.profiles.find((p) => p.id === id) ?? null;
      setProfile(person);
      const visible = await api.getVisibleRecommendations(user.id);
      const theirs = visible.filter((r) => r.recommender_id === id && r.status === 'active').map((r) => {
        const pro = state.professionals.find((p) => p.id === r.professional_id);
        return pro ? { rec: r, pro } : null;
      }).filter(Boolean) as { rec: ProfessionalRecommendation; pro: Professional }[];
      setRecs(person?.privacy.showProfessionalRelationships === 'none' && person.id !== user.id ? [] : theirs);
      setLoading(false);
    })();
  }, [id, user]);
  if (loading) return <LoadingState />;
  if (!profile || !user) return <Screen><EmptyState title="Person not found" description="This profile is unavailable." /></Screen>;
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar name={profile.full_name} uri={profile.avatar_url} size={80} />
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.meta}>In your circle</Text>
      </View>
      <Text style={styles.section}>Professionals they recommend</Text>
      {recs.length === 0 ? <Text style={styles.muted}>No recommendations visible to you.</Text> : recs.map(({ rec, pro }) => (
        <Pressable key={rec.id} style={styles.card} onPress={() => router.push(`/professional/${pro.id}`)}>
          <View style={styles.titleLine}><Text style={styles.cardTitle}>{pro.name}</Text>{pro.is_verified ? <VerifiedBadge /> : null}</View>
          <Text style={styles.cardBody}>{pro.category}</Text>
          {profile.privacy.acceptIntroductions ? (
            <Button title="Request introduction" variant="secondary" onPress={() => router.push({ pathname: '/request-intro', params: { professionalId: pro.id, intermediaryId: profile.id } })} style={{ marginTop: spacing.sm }} />
          ) : <Text style={styles.muted}>Not accepting introductions right now.</Text>}
        </Pressable>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  name: { ...typography.h2, color: colors.text.primary },
  meta: { ...typography.caption, color: colors.text.secondary },
  section: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm },
  muted: { ...typography.caption, color: colors.text.muted },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.surface.border },
  titleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  cardTitle: { ...typography.bodyMedium, color: colors.text.primary },
  cardBody: { ...typography.caption, color: colors.text.secondary },
});
