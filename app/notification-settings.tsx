import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

const ROWS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'requests', label: 'Quote and booking requests' },
  { key: 'introductions', label: 'Introductions' },
  { key: 'references', label: 'References to confirm' },
  { key: 'applications', label: 'Application status' },
  { key: 'reports', label: 'Reports you sent' },
];

export default function NotificationSettingsScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences>(user?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES);
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Notification preferences</Text>
      <Text style={styles.sub}>These control the in-app notification centre. Push and email are not sent yet.</Text>
      {ROWS.map((row) => (
        <Pressable key={row.key} style={styles.option} onPress={() => setPrefs((current) => ({ ...current, [row.key]: !current[row.key] }))}>
          <Text style={styles.optionText}>{prefs[row.key] ? '✓' : '○'} {row.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.todo}>TODO: when push and email are added, honour these same switches. Do not send either from this prototype.</Text>
      <Button title="Save preferences" onPress={async () => { await updateUser({ notification_preferences: prefs }); router.back(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  option: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.sm },
  optionText: { ...typography.body, color: colors.text.primary },
  todo: { ...typography.caption, color: colors.text.muted, marginBottom: spacing.md },
});
