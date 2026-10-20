import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Professional, Profile, TrustLabel, IntroductionRequest } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function ProfessionalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [pro, setPro] = useState<Professional | null>(null);
  const [recommenders, setRecommenders] = useState<Profile[]>([]);
  const [label, setLabel] = useState<TrustLabel>('recommended');
  const [intro, setIntro] = useState<IntroductionRequest | null>(null);
  const [contactVisible, setContactVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const state = await api.getState();
      const professional = state.professionals.find((p) => p.id === id) ?? null;
      setPro(professional);
      const visible = await api.getVisibleRecommendations(user.id);
      const recs = visible.filter((r) => r.professional_id === id && r.status === 'active');
      const people = recs.map((r) => state.profiles.find((p) => p.id === r.recommender_id)).filter(Boolean) as Profile[];
      setRecommenders(people.filter((p) => p.privacy.showNameOnRecommendations || p.id === user.id));
      const personal = state.personalTrusts.find((t) => t.user_id === user.id && t.professional_id === id);
      const acceptedIntro = state.introductions.find((i) => i.professional_id === id && i.requester_id === user.id && i.status === 'accepted');
      setIntro(acceptedIntro ?? null);
      if (personal) setLabel('personally_trusted');
      else if (acceptedIntro) setLabel('introduced');
      else setLabel('recommended');
      setContactVisible(Boolean(acceptedIntro || professional?.created_by === user.id || professional?.owner_user_id === user.id));
      setLoading(false);
    })();
  }, [id, user]);
  if (loading) return <LoadingState />;
  if (!pro || !user) return <Screen><EmptyState title="Professional not found" description="This record is unavailable." /></Screen>;
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar name={pro.name} uri={pro.avatar_url} size={80} />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{pro.name}</Text>
          {pro.is_verified ? <VerifiedBadge /> : null}
        </View>
        <Text style={styles.meta}>{pro.category}</Text>
        {pro.location ? <Text style={styles.meta}>{pro.location}</Text> : null}
        <TrustBadge label={label} />
      </View>
      {pro.bio ? <Text style={styles.bio}>{pro.bio}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.label}>Credentials</Text>
        <Text style={styles.body}>{pro.is_verified ? 'Verified by LifeCircle.' : 'Not independently verified.'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Contact</Text>
        {contactVisible ? (
          <>
            <Text style={styles.body}>{pro.contact_email ?? 'No email provided'}</Text>
            {pro.website ? <Button title="Open website" variant="secondary" onPress={() => Linking.openURL(pro.website!)} /> : null}
          </>
        ) : <Text style={styles.muted}>Private contact details are shared only after an introduction is accepted.</Text>}
      </View>
      <Text style={styles.section}>Recommended by</Text>
      {recommenders.length === 0 ? <Text style={styles.muted}>No visible recommenders for your permissions.</Text> : recommenders.map((r) => <Text key={r.id} style={styles.body}>{r.full_name}</Text>)}
      {recommenders.length > 0 && label !== 'personally_trusted' ? (
        <Button title="Request introduction" onPress={() => router.push({ pathname: '/request-intro', params: { professionalId: pro.id, intermediaryId: recommenders[0].id } })} style={{ marginTop: spacing.md }} />
      ) : null}
      <Button title="Recommend to my circle" variant="secondary" onPress={() => router.push({ pathname: '/recommend', params: { professionalId: pro.id } })} style={{ marginTop: spacing.sm }} />
      {label === 'personally_trusted' ? (
        <Button title="Remove personal trust" variant="danger" onPress={async () => { await api.removePersonalTrust(user.id, pro.id); setLabel(intro ? 'introduced' : 'recommended'); }} style={{ marginTop: spacing.sm }} />
      ) : (
        <Button title="Add to My Circle (personally trust)" variant="teal" onPress={async () => {
          await api.addPersonalTrust(user.id, pro.id, intro?.id ?? null);
          setLabel('personally_trusted');
          Alert.alert('Added to your circle', 'Personal trust is independent of recommendations.');
        }} style={{ marginTop: spacing.sm }} />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, marginBottom: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm },
  name: { ...typography.h2, color: colors.text.primary },
  meta: { ...typography.caption, color: colors.text.secondary },
  bio: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.surface.border, gap: 4 },
  label: { ...typography.label, color: colors.text.secondary },
  body: { ...typography.body, color: colors.text.primary },
  muted: { ...typography.caption, color: colors.text.muted },
  section: { ...typography.h3, color: colors.text.primary, marginTop: spacing.md, marginBottom: spacing.sm },
});
