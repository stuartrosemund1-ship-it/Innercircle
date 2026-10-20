import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { Button } from './Button';
export function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, color: colors.text.primary, textAlign: 'center' },
  description: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
});
