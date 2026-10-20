import { useState } from 'react';
import { Alert, StyleSheet, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { RecommendationVisibility } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';
const OPTIONS: { value: RecommendationVisibility; label: string; help: string }[] = [
  { value: 'private', label: 'Private', help: 'Only you can see this recommendation.' },
  { value: 'connections', label: 'Connections', help: 'Visible to accepted people in your circle.' },
  { value: 'circle', label: 'Circle', help: 'Visible across your permitted circle.' },
];
export default function RecommendScreen() {
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<RecommendationVisibility>('connections');
  const [loading, setLoading] = useState(false);
  if (!user || !professionalId) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Recommend a professional</Text>
      <Text style={styles.sub}>Recommending does not transfer personal trust.</Text>
      <TextField label="Optional note" value={note} onChangeText={setNote} multiline />
      {OPTIONS.map((o) => (
        <Pressable key={o.value} onPress={() => setVisibility(o.value)} style={[styles.option, visibility === o.value && styles.optionActive]}>
          <Text style={styles.optionTitle}>{o.label}</Text>
          <Text style={styles.optionHelp}>{o.help}</Text>
        </Pressable>
      ))}
      <Button title="Save recommendation" loading={loading} onPress={async () => {
        setLoading(true);
        try { await api.recommendProfessional(user.id, professionalId, note || null, visibility); Alert.alert('Recommendation saved'); router.back(); }
        catch (e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again'); }
        finally { setLoading(false); }
      }} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  option: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, backgroundColor: colors.surface.card, marginBottom: spacing.sm },
  optionActive: { borderColor: colors.brand.purple, backgroundColor: colors.brand.purpleSoft },
  optionTitle: { ...typography.bodyMedium, color: colors.text.primary },
  optionHelp: { ...typography.caption, color: colors.text.secondary },
});
