import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { brandName, colors, spacing, tagline, typography } from '@/constants/theme';
import { isDemoMode } from '@/lib/config';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <LinearGradient colors={[colors.gradient.start, colors.gradient.mid, colors.gradient.end]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.logo}>{brandName}</Text>
        <Text style={styles.tagline}>{tagline}</Text>
      </LinearGradient>
      <View style={styles.copy}>
        <Text style={styles.headline}>Trust spreads through people</Text>
        <Text style={styles.body}>Discover professionals through friends you already trust — then decide for yourself who belongs in your circle.</Text>
        {isDemoMode ? <Text style={styles.demoNote}>Running in a labelled development environment. Data stays on this device until Supabase credentials are configured.</Text> : null}
      </View>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/(auth)/sign-up')} />
        <Button title="Sign in" variant="secondary" onPress={() => router.push('/(auth)/sign-in')} style={{ marginTop: spacing.sm }} />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  hero: { borderRadius: 24, paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center', marginBottom: spacing.lg },
  logo: { ...typography.brand, color: colors.text.inverse },
  tagline: { ...typography.bodyMedium, color: 'rgba(255,255,255,0.92)', marginTop: spacing.sm },
  copy: { gap: spacing.sm, marginBottom: spacing.xl },
  headline: { ...typography.h2, color: colors.text.primary },
  body: { ...typography.body, color: colors.text.secondary },
  demoNote: { ...typography.caption, color: colors.demo.bannerText, backgroundColor: colors.demo.banner, padding: spacing.sm, borderRadius: 8, overflow: 'hidden' },
  actions: { marginTop: 'auto' },
});
