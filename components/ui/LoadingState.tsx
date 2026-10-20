import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <View style={styles.wrap}><ActivityIndicator size="large" color={colors.brand.purple} /><Text style={styles.label}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  label: { ...typography.body, color: colors.text.secondary },
});
