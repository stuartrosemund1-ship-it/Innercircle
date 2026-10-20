import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';
export function TextField({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.text.muted} style={[styles.input, error ? styles.inputError : null, style]} {...rest} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.text.secondary },
  input: { ...typography.body, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.surface.border, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.text.primary },
  inputError: { borderColor: colors.state.error },
  error: { ...typography.caption, color: colors.state.error },
});
