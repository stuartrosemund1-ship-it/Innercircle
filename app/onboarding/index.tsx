import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { brandName, colors, radii, spacing, typography } from '@/constants/theme';

const STEPS = [
  { title: `Welcome to ${brandName}`, body: 'Discover trusted professionals through people you already know. Trust spreads through people.' },
  { title: 'Create My Circle', body: 'Invite friends and family when you are ready. You will never be required to upload your entire address book.' },
  { title: 'Add a trusted professional', body: 'Add someone you already use or trust. Recommendations you share stay under your privacy controls.' },
  { title: 'Explore shared connections', body: 'See recommendations from your circle, request introductions, then decide independently who you personally trust.' },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const { updateUser } = useAuth();
  const router = useRouter();
  const current = STEPS[step];
  async function finish() { await updateUser({ onboarding_completed: true }); router.replace('/(tabs)'); }
  return (
    <Screen contentStyle={{ flex: 1, justifyContent: 'center' }}>
      <View style={styles.card}>
        <Text style={styles.step}>Step {step + 1} of {STEPS.length}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
      </View>
      {step < STEPS.length - 1 ? <Button title="Continue" onPress={() => setStep((s) => s + 1)} /> : <Button title="Enter LifeCircle" onPress={finish} />}
      <Button title="Skip for now" variant="ghost" onPress={finish} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface.card, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.xl },
  step: { ...typography.label, color: colors.brand.purple, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.text.secondary },
});
