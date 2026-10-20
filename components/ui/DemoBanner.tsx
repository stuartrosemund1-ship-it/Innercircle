import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { isDemoMode } from '@/lib/config';
export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <View style={styles.banner} accessibilityRole="text">
      <Text style={styles.text}>Development environment — demo data stays local. Not production.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  banner: { backgroundColor: colors.demo.banner, paddingVertical: 8, paddingHorizontal: spacing.md },
  text: { ...typography.caption, color: colors.demo.bannerText, textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium' },
});
