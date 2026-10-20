import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/constants/theme';
import type { TrustLabel } from '@/types';
const LABELS: Record<TrustLabel, string> = { recommended: 'Recommended', introduced: 'Introduced', personally_trusted: 'Personally trusted' };
const TINT: Record<TrustLabel, { bg: string; fg: string }> = {
  recommended: { bg: colors.brand.purpleSoft, fg: colors.brand.purpleDeep },
  introduced: { bg: colors.brand.blueSoft, fg: colors.brand.blue },
  personally_trusted: { bg: colors.brand.tealSoft, fg: colors.brand.teal },
};
export function TrustBadge({ label }: { label: TrustLabel }) {
  const tint = TINT[label];
  return <View style={[styles.badge, { backgroundColor: tint.bg }]}><Text style={[styles.text, { color: tint.fg }]}>{LABELS[label]}</Text></View>;
}
const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  text: { ...typography.label, fontSize: 12 },
});
