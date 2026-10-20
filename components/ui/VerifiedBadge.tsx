import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/constants/theme';

/** Checkmark and "Verified" label for a professional an admin has verified. */
export function VerifiedBadge() {
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel="Verified">
      <Text style={styles.mark}>✓</Text>
      <Text style={styles.text}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.brand.tealSoft,
  },
  mark: { color: colors.brand.teal, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', lineHeight: 16 },
  text: { ...typography.label, fontSize: 12, color: colors.brand.teal },
});
