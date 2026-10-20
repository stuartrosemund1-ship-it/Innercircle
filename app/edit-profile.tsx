import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, typography } from '@/constants/theme';
export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [loading, setLoading] = useState(false);
  if (!user) return null;
  return (
    <Screen scroll>
      <Avatar name={fullName || user.full_name} uri={user.avatar_url} size={88} />
      <TextField label="Full name" value={fullName} onChangeText={setFullName} />
      <TextField label="City" value={city} onChangeText={setCity} />
      <TextField label="Bio" value={bio} onChangeText={setBio} multiline />
      <Button title="Save profile" loading={loading} onPress={async () => {
        setLoading(true);
        try { await updateUser({ full_name: fullName.trim(), bio: bio.trim() || null, city: city.trim() || null }); router.back(); }
        catch (e) { Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again'); }
        finally { setLoading(false); }
      }} />
    </Screen>
  );
}
