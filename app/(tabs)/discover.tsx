import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { PROFESSIONAL_CATEGORIES, type Profile, type Professional } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function DiscoverScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [people, setPeople] = useState<Profile[]>([]);
  const [network, setNetwork] = useState<Professional[]>([]);
  const [general, setGeneral] = useState<Professional[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const result = await api.search(user.id, query, category);
      if (cancelled) return;
      setPeople(result.people); setNetwork(result.networkProfessionals); setGeneral(result.generalProfessionals);
    })();
    return () => { cancelled = true; };
  }, [user, query, category]);
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.sub}>Network recommendations are prioritised. General results are labelled honestly.</Text>
      <TextField label="Search" placeholder="People, professionals, categories…" value={query} onChangeText={setQuery} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Pressable style={[styles.chip, !category && styles.chipActive]} onPress={() => setCategory(undefined)}><Text style={styles.chipText}>All</Text></Pressable>
        {PROFESSIONAL_CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}><Text style={styles.chipText}>{c}</Text></Pressable>
        ))}
      </ScrollView>
      <Text style={styles.section}>People in your circle</Text>
      {people.length === 0 ? <Text style={styles.muted}>No matching connections.</Text> : people.map((p) => (
        <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/person/${p.id}`)}>
          <Avatar name={p.full_name} uri={p.avatar_url} /><View><Text style={styles.rowTitle}>{p.full_name}</Text><Text style={styles.rowSub}>{p.city ?? 'In your circle'}</Text></View>
        </Pressable>
      ))}
      <Text style={styles.section}>From your network</Text>
      {network.length === 0 ? <EmptyState title="No network matches" description="If there is no trusted recommendation, we say so rather than implying someone has been vetted by your circle." />
        : network.map((p) => (
          <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/professional/${p.id}`)}>
            <Avatar name={p.name} uri={p.avatar_url} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.titleLine}><Text style={styles.rowTitle}>{p.name}</Text>{p.is_verified ? <VerifiedBadge /> : null}</View>
              <Text style={styles.rowSub}>{p.category}</Text>
              <Text style={styles.badge}>Network recommendation</Text>
            </View>
          </Pressable>
        ))}
      <Text style={styles.section}>Your own records (not network-vetted)</Text>
      {general.length === 0 ? <Text style={styles.muted}>No general matches in your private records.</Text> : general.map((p) => (
        <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/professional/${p.id}`)}>
          <Avatar name={p.name} uri={p.avatar_url} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.titleLine}><Text style={styles.rowTitle}>{p.name}</Text>{p.is_verified ? <VerifiedBadge /> : null}</View>
            <Text style={styles.rowSub}>Not presented as circle-vetted</Text>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  chips: { marginBottom: spacing.md, maxHeight: 44 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.surface.muted, marginRight: 8 },
  chipActive: { backgroundColor: colors.brand.purpleSoft },
  chipText: { ...typography.caption, color: colors.text.secondary },
  section: { ...typography.h3, color: colors.text.primary, marginTop: spacing.md, marginBottom: spacing.sm },
  muted: { ...typography.caption, color: colors.text.muted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.surface.card, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.surface.border },
  titleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  rowTitle: { ...typography.bodyMedium, color: colors.text.primary },
  rowSub: { ...typography.caption, color: colors.text.secondary },
  badge: { ...typography.label, color: colors.brand.purple, marginTop: 4, fontSize: 11 },
});
