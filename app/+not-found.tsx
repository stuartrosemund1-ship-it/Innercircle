import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen does not exist.</Text>
        <Link href="/" style={styles.link}><Text style={styles.linkText}>Go to home</Text></Link>
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.surface.background },
  title: { ...typography.h3, color: colors.text.primary },
  link: { marginTop: spacing.md },
  linkText: { ...typography.bodyMedium, color: colors.brand.purple },
});
