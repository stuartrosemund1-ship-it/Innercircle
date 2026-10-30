import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { PriceRange } from '@/components/ui/PriceRange';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { applicationStatusLabel, isApprovedProfessional, isVerifiedProfessional } from '@/lib/application';
import type { Professional, ProfessionalReference, Profile, TrustLabel, IntroductionRequest } from '@/types';
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
  const [references, setReferences] = useState<ProfessionalReference[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
      setReferences(state.references.filter((reference) => reference.professional_id === id));
      setProfiles(state.profiles);
      setLoading(false);
    })();
  }, [id, user]);
  if (loading) return <LoadingState />;
  if (!pro || !user) return <Screen><EmptyState title="Professional not found" description="This record is unavailable." /></Screen>;
  const isApplicant = pro.created_by === user.id || pro.owner_user_id === user.id;
  const isReferee = references.some((reference) => reference.referee_id === user.id);
  if (!isApprovedProfessional(pro) && !isApplicant && !isReferee) {
    return <Screen><EmptyState title="Not available yet" description="This professional is not approved, so they are hidden from Discover." /></Screen>;
  }
  const verified = isVerifiedProfessional(pro);
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar name={pro.name} uri={pro.avatar_url} size={80} />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{pro.name}</Text>
          {verified ? <VerifiedBadge /> : null}
        </View>
        <Text style={styles.meta}>{pro.category}</Text>
        {pro.location ? <Text style={styles.meta}>{pro.location}</Text> : null}
        <PriceRange professional={pro} />
        {pro.pricing_notes ? <Text style={styles.meta}>{pro.pricing_notes}</Text> : null}
        {isApprovedProfessional(pro) ? <TrustBadge label={label} /> : null}
      </View>
      {isApplicant && pro.application_status !== 'approved' ? (
        <View style={[styles.card, styles.pending]}>
          <Text style={styles.label}>{applicationStatusLabel(pro.application_status)}</Text>
          {pro.application_status === 'pending' ? <Text style={styles.body}>An admin still needs to review this application. It stays out of Discover until it is approved.</Text> : null}
          {pro.application_status === 'draft' ? <Text style={styles.body}>This draft is saved on this device. Submit it when the documents and references are ready.</Text> : null}
          {pro.application_status === 'rejected' ? <Text style={styles.body}>{pro.application_rejection_reason ?? 'No reason was recorded.'}</Text> : null}
          {pro.application_status === 'draft' ? <Button title="Submit for review" onPress={async () => {
            try {
              const updated = await api.finalizeProfessionalApplication(user.id, pro.id);
              setPro(updated);
            } catch (error) { Alert.alert('Could not submit', error instanceof Error ? error.message : 'Try again'); }
          }} /> : null}
        </View>
      ) : null}
      {pro.bio ? <Text style={styles.bio}>{pro.bio}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.label}>Price</Text>
        <PriceRange professional={pro} />
        <Text style={styles.muted}>{pro.currency} · {pro.pricing_unit ? pro.pricing_unit.split('_').join(' ') : 'Unit not set'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Credentials</Text>
        <Text style={styles.body}>{verified ? 'Verified by LifeCircle.' : 'Not independently verified.'}</Text>
        {pro.years_experience != null ? <Text style={styles.body}>{pro.years_experience} years of experience</Text> : null}
        {pro.licence_number ? <Text style={styles.body}>{pro.licence_number} · {pro.licence_issuer}</Text> : null}
        {pro.service_area ? <Text style={styles.body}>Serves {pro.service_area}</Text> : null}
      </View>
      {isApplicant || isReferee ? (
        <View style={styles.card}>
          <Text style={styles.label}>References</Text>
          {references.length === 0 ? <Text style={styles.muted}>No references requested yet.</Text> : references.map((reference) => (
            <Text key={reference.id} style={styles.body}>{profiles.find((profile) => profile.id === reference.referee_id)?.full_name ?? 'Connection'} · {reference.status}</Text>
          ))}
        </View>
      ) : null}
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
      {isApprovedProfessional(pro) && recommenders.length > 0 && label !== 'personally_trusted' ? (
        <Button title="Request introduction" onPress={() => router.push({ pathname: '/request-intro', params: { professionalId: pro.id, intermediaryId: recommenders[0].id } })} style={{ marginTop: spacing.md }} />
      ) : null}
      {isApprovedProfessional(pro) ? <Button title="Recommend to my circle" variant="secondary" onPress={() => router.push({ pathname: '/recommend', params: { professionalId: pro.id } })} style={{ marginTop: spacing.sm }} /> : null}
      {isApprovedProfessional(pro) && label === 'personally_trusted' ? (
        <Button title="Remove personal trust" variant="danger" onPress={async () => { await api.removePersonalTrust(user.id, pro.id); setLabel(intro ? 'introduced' : 'recommended'); }} style={{ marginTop: spacing.sm }} />
      ) : isApprovedProfessional(pro) ? (
        <Button title="Add to My Circle (personally trust)" variant="teal" onPress={async () => {
          await api.addPersonalTrust(user.id, pro.id, intro?.id ?? null);
          setLabel('personally_trusted');
          Alert.alert('Added to your circle', 'Personal trust is independent of recommendations.');
        }} style={{ marginTop: spacing.sm }} />
      ) : null}
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
  pending: { backgroundColor: colors.demo.banner, borderColor: colors.demo.bannerText },
  label: { ...typography.label, color: colors.text.secondary },
  body: { ...typography.body, color: colors.text.primary },
  muted: { ...typography.caption, color: colors.text.muted },
  section: { ...typography.h3, color: colors.text.primary, marginTop: spacing.md, marginBottom: spacing.sm },
});
