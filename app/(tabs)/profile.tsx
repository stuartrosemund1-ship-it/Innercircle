import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isDemoMode } from '@/lib/config';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function ProfileScreen() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar name={user.full_name} uri={user.avatar_url} size={88} />
        <Text style={styles.name}>{user.full_name}</Text>
        <Text style={styles.meta}>{user.email}</Text>
        {user.city ? <Text style={styles.meta}>{user.city}</Text> : null}
      </View>
      <Button title="Edit profile" onPress={() => router.push('/edit-profile')} />
      <Button title="Privacy controls" variant="secondary" onPress={() => router.push('/privacy')} style={styles.gap} />
      <Button title="Invite a friend" variant="teal" onPress={() => router.push('/invite')} style={styles.gap} />
      {isDemoMode ? (
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Development tools</Text>
          <Text style={styles.demoBody}>Load labelled sample relationships for demos. Never runs against production Supabase.</Text>
          <Button title="Load development sample network" variant="secondary" onPress={async () => {
            await api.loadSampleNetwork(user.id);
            await refresh();
            Alert.alert('Sample network loaded', 'Sarah and James are now in your local demo circle.');
          }} style={styles.gap} />
          <Button title="Reset local demo data" variant="danger" onPress={() => {
            Alert.alert('Reset demo data?', 'This clears local development data on this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: async () => { await api.resetDemo(); await signOut(); } },
            ]);
          }} style={styles.gap} />
        </View>
      ) : null}
      <Button title="Sign out" variant="ghost" onPress={() => signOut()} style={styles.gap} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.lg, gap: 6 },
  name: { ...typography.h2, color: colors.text.primary },
  meta: { ...typography.caption, color: colors.text.secondary },
  gap: { marginTop: spacing.sm },
  demoBox: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.demo.banner, gap: spacing.xs },
  demoTitle: { ...typography.h3, color: colors.demo.bannerText },
  demoBody: { ...typography.caption, color: colors.demo.bannerText, marginBottom: spacing.sm },
});
