import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/reports';
import type { ReportReason, ReportTargetType } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function ReportScreen() {
  const { type, id } = useLocalSearchParams<{ type: ReportTargetType; id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  if (!user || !id || (type !== 'person' && type !== 'professional' && type !== 'job_media')) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Report this {type === 'person' ? 'person' : type === 'job_media' ? 'job photo' : 'professional'}</Text>
      <Text style={styles.sub}>Choose the closest reason. An admin can see the report. The other person is not told you sent it.</Text>
      {REPORT_REASONS.map((item) => (
        <Pressable key={item.value} onPress={() => setReason(item.value)} style={[styles.option, reason === item.value && styles.optionActive]}>
          <Text style={styles.optionText}>{item.label}</Text>
        </Pressable>
      ))}
      <TextField label="Details (optional)" value={details} onChangeText={setDetails} multiline />
      <Button title="Send report" loading={loading} onPress={async () => {
        setLoading(true);
        try {
          await api.fileReport(user.id, { targetType: type, targetId: id, reason, details: details.trim() || null });
          Alert.alert('Report sent', 'Thank you. An admin will review it.');
          router.back();
        } catch (error) {
          Alert.alert('Could not send', error instanceof Error ? error.message : 'Try again');
        } finally {
          setLoading(false);
        }
      }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  option: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.sm },
  optionActive: { borderColor: colors.brand.purple, backgroundColor: colors.brand.purpleSoft },
  optionText: { ...typography.body, color: colors.text.primary },
});
