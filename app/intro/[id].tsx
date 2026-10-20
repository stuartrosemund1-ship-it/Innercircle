import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { IntroductionRequest, Professional, Profile } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function IntroDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [intro, setIntro] = useState<IntroductionRequest | null>(null);
  const [requester, setRequester] = useState<Profile | null>(null);
  const [pro, setPro] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    (async () => {
      const state = await api.getState();
      const item = state.introductions.find((i) => i.id === id) ?? null;
      setIntro(item);
      if (item) {
        setRequester(state.profiles.find((p) => p.id === item.requester_id) ?? null);
        setPro(state.professionals.find((p) => p.id === item.professional_id) ?? null);
      }
      setLoading(false);
    })();
  }, [id]);
  if (loading) return <LoadingState />;
  if (!intro || !user) return <Screen><EmptyState title="Introduction not found" description="This request is unavailable." /></Screen>;
  const isIntermediary = intro.intermediary_id === user.id;
  async function respond(accept: boolean) {
    try {
      await api.respondIntroduction(intro!.id, user!.id, accept);
      Alert.alert(accept ? 'Introduction accepted' : 'Introduction declined');
      router.back();
    } catch (e) { Alert.alert('Could not respond', e instanceof Error ? e.message : 'Try again'); }
  }
  return (
    <Screen scroll>
      <View style={styles.card}>
        <Text style={styles.status}>{intro.status.toUpperCase()}</Text>
        <Text style={styles.title}>{requester?.full_name ?? 'Someone'} ↔ {pro?.name ?? 'Professional'}</Text>
        {intro.message ? <Text style={styles.body}>{intro.message}</Text> : null}
      </View>
      {isIntermediary && intro.status === 'pending' ? (
        <View style={{ gap: spacing.sm }}>
          <Button title="Accept introduction" variant="teal" onPress={() => respond(true)} />
          <Button title="Decline" variant="secondary" onPress={() => respond(false)} />
        </View>
      ) : null}
      {!isIntermediary && intro.status === 'accepted' ? (
        <Button title="View professional" onPress={() => router.push(`/professional/${intro.professional_id}`)} />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.lg, gap: spacing.sm },
  status: { ...typography.label, color: colors.brand.purple },
  title: { ...typography.h2, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary },
});
