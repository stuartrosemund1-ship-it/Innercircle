import { StyleSheet, Text } from 'react-native';
import { colors, typography } from '@/constants/theme';

export function StarRating({ value, count }: { value: number; count?: number }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  const stars = `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;
  const label = count == null ? value.toFixed(1) : `${value.toFixed(1)} · ${count} review${count === 1 ? '' : 's'}`;
  return <Text style={styles.text} accessibilityLabel={`${value.toFixed(1)} out of 5`}>{stars} {label}</Text>;
}

const styles = StyleSheet.create({
  text: { ...typography.bodyMedium, color: colors.brand.purpleDeep },
});
