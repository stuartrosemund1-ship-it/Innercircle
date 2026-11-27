import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View, Linking } from 'react-native';
import { TextField } from '@/components/ui/TextField';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { PriceRange } from '@/components/ui/PriceRange';
import { StarRating } from '@/components/ui/StarRating';
import { Logo } from '@/components/brand/Logo';
import { LifeTeamProofCard } from '@/components/circle/LifeTeamProofCard';
import { averageRating } from '@/lib/engagement';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { applicationStatusLabel, isApprovedProfessional, isVerifiedProfessional } from '@/lib/application';
import type { Professional, ProfessionalReference, ProfessionalReview, Profile, ServiceRequest, TrustLabel, IntroductionRequest } from '@/types';
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
  const [reviews, setReviews] = useState<ProfessionalReview[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [circleIds, setCircleIds] = useState<string[]>([]);
  const [reply, setReply] = useState('');
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
      setReviews(state.reviews.filter((review) => review.professional_id === id));
      setRequests(state.serviceRequests.filter((request) => request.professional_id === id));
      const connected = state.connections.filter((connection) => connection.status === 'accepted' && (connection.requester_id === user.id || connection.recipient_id === user.id)).map((connection) => connection.requester_id === user.id ? connection.recipient_id : connection.requester_id);
      setCircleIds(connected);
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
  const summary = averageRating(reviews);
  const circleReviews = reviews.filter((review) => circleIds.includes(review.author_id));
  const canReview = requests.some((request) => request.member_id === user.id && request.status === 'completed') || Boolean(intro);
  const alreadyReviewed = reviews.some((review) => review.author_id === user.id);
  const memberSince = new Date(pro.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return (
    <Screen scroll>
      <View style={styles.cover}>
        <Logo size={48} light />
        <Text style={styles.coverLabel}>LifeCircle</Text>
      </View>
      <View style={styles.header}>
        <Avatar name={pro.name} uri={pro.avatar_url} size={80} />
        <View style={styles.nameRow}>
          <Text style={styles.name}>{pro.name}</Text>
          {verified ? <VerifiedBadge /> : null}
        </View>
        <Text style={styles.meta}>{pro.category}</Text>
        {pro.location ? <Text style={styles.meta}>{pro.location}</Text> : null}
        <PriceRange professional={pro} />
        {summary ? <StarRating value={summary.average} count={summary.count} /> : <Text style={styles.meta}>No reviews yet</Text>}
        <Text style={styles.meta}>Member since {memberSince}</Text>
        {pro.typical_response_time ? <Text style={styles.meta}>{pro.typical_response_time}</Text> : null}
        {pro.pricing_notes ? <Text style={styles.meta}>{pro.pricing_notes}</Text> : null}
        {isApprovedProfessional(pro) ? <TrustBadge label={label} /> : null}
      </View>
      {isApprovedProfessional(pro) ? <LifeTeamProofCard professionalId={pro.id} viewerId={user.id} isOwner={isApplicant} /> : null}
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
      {isApprovedProfessional(pro) && !isApplicant ? (
        <Button title="Request a quote" onPress={() => router.push({ pathname: '/request-service', params: { professionalId: pro.id } })} style={{ marginBottom: spacing.sm }} />
      ) : null}
      {pro.qualifications.length > 0 ? (
        <View style={styles.badges}>
          {pro.qualifications.map((item) => <Text key={item} style={styles.badge}>{item}</Text>)}
        </View>
      ) : null}
      {pro.portfolio.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.label}>Past work</Text>
          {pro.portfolio.map((item) => (
            <View key={item.title} style={styles.work}>
              <Text style={styles.body}>{item.title}</Text>
              <Text style={styles.muted}>{item.caption}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.label}>{circleReviews.length} {circleReviews.length === 1 ? 'person' : 'people'} in your circle used them</Text>
        {circleReviews.length === 0 ? <Text style={styles.muted}>No one in your circle has reviewed them yet.</Text> : circleReviews.map((review) => (
          <Text key={review.id} style={styles.body}>{profiles.find((profile) => profile.id === review.author_id)?.full_name ?? 'A connection'}</Text>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Reviews</Text>
        {reviews.length === 0 ? <Text style={styles.muted}>Reviews appear after a completed booking or an accepted introduction.</Text> : reviews.map((review) => (
          <View key={review.id} style={styles.work}>
            <Text style={styles.body}>{profiles.find((profile) => profile.id === review.author_id)?.full_name ?? 'Member'} · {review.rating}/5</Text>
            <Text style={styles.muted}>{review.body}</Text>
            {review.owner_reply ? <Text style={styles.reply}>Reply: {review.owner_reply}</Text> : null}
          </View>
        ))}
        {canReview && !alreadyReviewed ? <Button title="Leave a review" variant="secondary" onPress={() => router.push({ pathname: '/review', params: { professionalId: pro.id } })} /> : null}
        {isApplicant ? (
          <>
            <TextField label="Reply to the latest review" value={reply} onChangeText={setReply} />
            <Button title="Post reply" variant="secondary" onPress={async () => {
              const target = reviews.find((review) => !review.owner_reply) ?? reviews[0];
              if (!target) { Alert.alert('No review yet', 'Replies appear once someone has reviewed you.'); return; }
              try { await api.replyToReview(user.id, target.id, reply); setReply(''); const state = await api.getState(); setReviews(state.reviews.filter((review) => review.professional_id === pro.id)); }
              catch (error) { Alert.alert('Could not reply', error instanceof Error ? error.message : 'Try again'); }
            }} />
          </>
        ) : null}
      </View>
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
      <Button title="Report this professional" variant="secondary" onPress={() => router.push({ pathname: '/report', params: { type: 'professional', id: pro.id } })} style={{ marginTop: spacing.md }} />
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
  cover: { backgroundColor: colors.brand.purple, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.md, gap: spacing.xs },
  coverLabel: { ...typography.label, color: colors.text.inverse },
  header: { alignItems: 'center', gap: 6, marginBottom: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  badge: { ...typography.caption, color: colors.brand.purpleDeep, backgroundColor: colors.brand.purpleSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, overflow: 'hidden' },
  work: { gap: 2, marginBottom: spacing.sm },
  reply: { ...typography.caption, color: colors.text.primary, marginTop: 4 },
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
