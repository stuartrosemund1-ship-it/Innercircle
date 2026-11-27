import { createElement, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { jobMediaBadge, templateLabel } from '@/lib/jobMedia';
import { mediaUrl } from '@/lib/mediaUrl';
import type { JobMedia, ProfessionalReview } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

function Still({ uri, caption }: { uri: string | null; caption: string }) {
  const source = mediaUrl(uri);
  return (
    <View style={styles.frame}>
      <Text style={styles.caption}>{caption}</Text>
      {source ? <Image source={{ uri: source }} style={styles.image} resizeMode="cover" /> : <Text style={styles.caption}>No image</Text>}
    </View>
  );
}

export default function JobMediaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [item, setItem] = useState<JobMedia | null>(null);
  const [review, setReview] = useState<ProfessionalReview | null>(null);
  useEffect(() => {
    if (!id) return;
    api.getState().then((state) => {
      const found = state.jobMedia.find((media) => media.id === id) ?? null;
      setItem(found);
      setReview(found?.review_id ? state.reviews.find((entry) => entry.id === found.review_id) ?? null : null);
    });
  }, [id]);
  if (!user || !id) return null;
  if (!item || (item.consent_status !== 'approved' && !user.is_admin)) return <Screen><EmptyState title="Not public" description="This job stays hidden until the customer agrees." /></Screen>;
  const video = mediaUrl(item.media_path);
  return (
    <Screen scroll>
      <Text style={styles.badge}>{jobMediaBadge(item)} · {templateLabel(item.template)}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{item.job_date ? new Date(item.job_date).toLocaleDateString('en-GB') : 'Date not shown'}{item.location_area ? ` · ${item.location_area}` : ''}</Text>
      {item.kind === 'summary' ? <Text style={styles.body}>{item.summary_text}</Text> : null}
      {item.template === 'before_after' ? (
        <View style={styles.pair}>
          <Still uri={item.before_path} caption="Before" />
          <Still uri={item.media_path} caption="After" />
        </View>
      ) : null}
      {item.kind === 'image' && item.template !== 'before_after' ? <Still uri={item.media_path} caption="Photo" /> : null}
      {item.kind === 'video' && video ? (
        Platform.OS === 'web'
          ? createElement('video', { src: video, controls: true, playsInline: true, style: { width: '100%', maxHeight: 360, borderRadius: 12, backgroundColor: '#1A1A2E' } })
          : <Text style={styles.body}>Open this profile in the browser to play the video.</Text>
      ) : null}
      {review ? <Text style={styles.body}>Linked review: {review.rating}/5. {review.body}</Text> : null}
      <Button title="Report this media" variant="secondary" onPress={() => router.push({ pathname: '/report', params: { type: 'job_media', id: item.id } })} style={{ marginTop: spacing.md }} />
      {user.is_admin ? <Button title="Remove media" variant="danger" onPress={async () => { await api.adminRemoveJobMedia(user.id, item.id); router.back(); }} style={{ marginTop: spacing.sm }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { ...typography.label, color: colors.brand.teal },
  title: { ...typography.h2, color: colors.text.primary, marginTop: spacing.xs },
  meta: { ...typography.caption, color: colors.text.secondary, marginBottom: spacing.md },
  body: { ...typography.body, color: colors.text.primary, marginBottom: spacing.md },
  pair: { gap: spacing.sm },
  frame: { gap: spacing.xs, marginBottom: spacing.sm },
  caption: { ...typography.label, color: colors.text.secondary },
  image: { width: '100%', height: 220, borderRadius: radii.md, backgroundColor: colors.surface.muted },
});
