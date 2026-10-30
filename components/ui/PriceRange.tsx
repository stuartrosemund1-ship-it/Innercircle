import { StyleSheet, Text } from 'react-native';
import { formatPriceRange } from '@/lib/pricing';
import type { Professional } from '@/types';
import { colors, typography } from '@/constants/theme';

export function PriceRange({ professional }: { professional: Pick<Professional, 'price_min' | 'price_max' | 'currency' | 'pricing_unit'> }) {
  const label = formatPriceRange(professional);
  if (!label) return null;
  return <Text style={styles.price}>{label}</Text>;
}

const styles = StyleSheet.create({
  price: { ...typography.bodyMedium, color: colors.brand.purpleDeep },
});
