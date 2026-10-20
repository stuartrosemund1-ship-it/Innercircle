import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/constants/theme';
export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={`${name} photo`} />;
  return (
    <View accessibilityLabel={`${name} avatar`} style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials || '?'}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.brand.purpleSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface.border },
  initials: { ...typography.bodyMedium, color: colors.brand.purpleDeep },
});
