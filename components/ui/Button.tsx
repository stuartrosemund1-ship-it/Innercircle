import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, radii, typography } from '@/constants/theme';
type Variant = 'primary' | 'secondary' | 'teal' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: { title: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={isDisabled} style={({ pressed }) => [styles.base, styles[variant], pressed && !isDisabled && styles.pressed, isDisabled && styles.disabled, style]}>
      {loading ? <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.brand.purple : '#fff'} /> : (
        <Text style={[styles.label, (variant === 'secondary' || variant === 'ghost') && styles.labelDark, variant === 'danger' && styles.labelDanger]}>{title}</Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.brand.purple },
  secondary: { backgroundColor: colors.brand.purpleSoft, borderWidth: 1, borderColor: colors.surface.border },
  teal: { backgroundColor: colors.brand.teal },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: '#FEE2E2' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  label: { ...typography.button, color: colors.text.inverse },
  labelDark: { color: colors.brand.purpleDeep },
  labelDanger: { color: colors.state.error },
});
