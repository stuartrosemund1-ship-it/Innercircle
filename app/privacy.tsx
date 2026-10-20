import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import type { PrivacySettings } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';
export default function PrivacyScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [privacy, setPrivacy] = useState<PrivacySettings>(user?.privacy ?? { profileVisibility: 'connections', showNameOnRecommendations: true, acceptIntroductions: true, showProfessionalRelationships: 'connections' });
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Privacy controls</Text>
      <Pressable style={styles.option} onPress={() => setPrivacy((p) => ({ ...p, showNameOnRecommendations: !p.showNameOnRecommendations }))}>
        <Text style={styles.optionText}>{privacy.showNameOnRecommendations ? '✓' : '○'} Show my name beside recommendations</Text>
      </Pressable>
      <Pressable style={styles.option} onPress={() => setPrivacy((p) => ({ ...p, acceptIntroductions: !p.acceptIntroductions }))}>
        <Text style={styles.optionText}>{privacy.acceptIntroductions ? '✓' : '○'} Accept introduction requests</Text>
      </Pressable>
      <Button title="Save privacy settings" onPress={async () => { await updateUser({ privacy }); router.back(); }} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.md },
  option: { padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.surface.border, marginBottom: spacing.sm },
  optionText: { ...typography.body, color: colors.text.primary },
});
