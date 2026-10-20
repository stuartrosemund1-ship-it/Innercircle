import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { PROFESSIONAL_CATEGORIES, type ProfessionalCategory } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';
export default function AddProfessionalScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProfessionalCategory>(PROFESSIONAL_CATEGORIES[0]);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Add a professional</Text>
      <TextField label="Name" value={name} onChangeText={setName} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {PROFESSIONAL_CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}><Text style={styles.chipText}>{c}</Text></Pressable>
        ))}
      </ScrollView>
      <TextField label="Biography" value={bio} onChangeText={setBio} multiline />
      <TextField label="Location" value={location} onChangeText={setLocation} />
      <Button title="Save professional" loading={loading} disabled={!name} onPress={async () => {
        setLoading(true);
        try {
          const pro = await api.createProfessional(user.id, { name, category, bio: bio || null, location: location || null, website: null, contact_email: null, contact_phone: null, experience: null, availability: null, avatar_url: null });
          await api.recommendProfessional(user.id, pro.id, null, 'connections');
          await api.addPersonalTrust(user.id, pro.id, null);
          router.replace(`/professional/${pro.id}`);
        } catch (e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again'); }
        finally { setLoading(false); }
      }} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.surface.muted, marginRight: 8 },
  chipActive: { backgroundColor: colors.brand.purpleSoft },
  chipText: { ...typography.caption, color: colors.text.secondary },
});
