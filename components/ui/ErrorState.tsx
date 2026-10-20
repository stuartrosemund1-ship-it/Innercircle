import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { Button } from './Button';
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3, color: colors.state.error },
  message: { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing.sm },
});
