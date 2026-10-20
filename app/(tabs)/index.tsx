import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useCircleData } from '@/hooks/useCircleData';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';

function firstName(full: string) { return full.split(' ')[0] || full; }

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const data = useCircleData();
  if (!user) return null;
  if (data.loading) return <LoadingState />;
  if (data.error) return <ErrorState message={data.error} onRetry={data.refresh} />;

  const recCards = data.recommendations.filter((r) => r.recommender_id !== user.id).slice(0, 5).map((r) => {
    const recommender = data.people.find((p) => p.id === r.recommender_id);
    const pro = data.professionals.find((p) => p.id === r.professional_id);
    if (!recommender || !pro) return null;
    return { r, recommender, pro };
  }).filter(Boolean) as { r: (typeof data.recommendations)[0]; recommender: (typeof data.people)[0]; pro: (typeof data.professionals)[0] }[];

  const pendingIntros = data.introductions.filter((i) => i.status === 'pending' && i.intermediary_id === user.id);

  return (
    <Screen scroll onRefresh={data.refresh}>
      <Text style={styles.greeting}>Hello, {firstName(user.full_name)}</Text>
      <Text style={styles.sub}>Your circle. Better life.</Text>
      <View style={styles.summary}>
        <View style={styles.stat}><Text style={styles.statNum}>{data.people.length}</Text><Text style={styles.statLabel}>People</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{data.personalTrusts.length}</Text><Text style={styles.statLabel}>Trusted pros</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{data.pendingIncoming.length}</Text><Text style={styles.statLabel}>Invites</Text></View>
      </View>
      <Text style={styles.section}>Quick actions</Text>
      <Button title="Add a Person" variant="secondary" onPress={() => router.push('/add-person')} />
      <Button title="Add a Professional" onPress={() => router.push('/add-professional')} style={styles.actionGap} />
      <Button title="Invite a Friend" variant="teal" onPress={() => router.push('/invite')} style={styles.actionGap} />
      <Button title="Explore Trusted Professionals" variant="ghost" onPress={() => router.push('/(tabs)/discover')} style={styles.actionGap} />
      <Text style={styles.section}>Recently shared recommendations</Text>
      {recCards.length === 0 ? (
        <View style={styles.card}><Text style={styles.cardBody}>Recommendations from people in your circle will appear here. Nothing invented — only real relationships in your network.</Text></View>
      ) : recCards.map(({ r, recommender, pro }) => (
        <Pressable key={r.id} style={styles.card} onPress={() => router.push(`/professional/${pro.id}`)}>
          <View style={styles.row}>
            <Avatar name={recommender.full_name} uri={recommender.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleLine}>
                <Text style={styles.cardTitle}>{recommender.full_name} has shared {pro.name} with you</Text>
                {pro.is_verified ? <VerifiedBadge /> : null}
              </View>
              <Text style={styles.cardBody}>{pro.category}</Text>
            </View>
          </View>
        </Pressable>
      ))}
      <Text style={styles.section}>Suggested introductions</Text>
      {recCards.length === 0 ? (
        <View style={styles.card}><Text style={styles.cardBody}>When a connection recommends a professional, you can request an introduction here.</Text></View>
      ) : recCards.slice(0, 3).map(({ recommender, pro }) => (
        <Pressable key={`sug-${pro.id}-${recommender.id}`} style={styles.card} onPress={() => router.push({ pathname: '/request-intro', params: { professionalId: pro.id, intermediaryId: recommender.id } })}>
          <View style={styles.titleLine}>
            <Text style={styles.cardTitle}>Your friend {firstName(recommender.full_name)} can introduce you to {pro.name}</Text>
            {pro.is_verified ? <VerifiedBadge /> : null}
          </View>
          <Text style={styles.cardBody}>Request an introduction — trust is never transferred automatically.</Text>
        </Pressable>
      ))}
      {pendingIntros.map((i) => (
        <Pressable key={i.id} style={styles.card} onPress={() => router.push(`/intro/${i.id}`)}>
          <Text style={styles.cardTitle}>Someone asked you for an introduction</Text>
          <Text style={styles.cardBody}>Open to accept or decline.</Text>
        </Pressable>
      ))}
      <Text style={styles.section}>Recent activity</Text>
      {data.notifications.slice(0, 4).map((n) => (
        <Pressable key={n.id} style={styles.card} onPress={() => router.push('/(tabs)/activity')}>
          <Text style={styles.cardTitle}>{n.title}</Text>
          <Text style={styles.cardBody}>{n.body}</Text>
        </Pressable>
      ))}
      {data.notifications.length === 0 ? <View style={styles.card}><Text style={styles.cardBody}>Your circle activity will show up here.</Text></View> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  greeting: { ...typography.h1, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  summary: { flexDirection: 'row', backgroundColor: colors.surface.card, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.lg, ...shadows.soft },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { ...typography.h2, color: colors.brand.purple },
  statLabel: { ...typography.caption, color: colors.text.muted },
  section: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  actionGap: { marginTop: spacing.sm },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.surface.border },
  titleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  cardTitle: { ...typography.bodyMedium, color: colors.text.primary },
  cardBody: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
});
