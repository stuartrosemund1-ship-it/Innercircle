import { useState } from 'react';
import { Alert, StyleSheet, Text, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';
export default function InviteScreen() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (!user) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Invite a friend</Text>
      <Text style={styles.sub}>Share a secure link. Accepting connects people — it does not auto-expose professional relationships.</Text>
      <TextField label="Optional email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Button title="Create invite link" loading={loading} onPress={async () => {
        setLoading(true);
        try {
          const invitation = await api.createInvitation(user.id, email || null);
          const plain = invitation.invite_token_plain ?? invitation.id;
          setToken(plain);
          const link = `lifecircle://invite/${plain}`;
          await Clipboard.setStringAsync(link);
          await Share.share({ message: `Join my LifeCircle: ${link}` });
        } catch (e) { Alert.alert('Could not create invite', e instanceof Error ? e.message : 'Try again'); }
        finally { setLoading(false); }
      }} />
      {token ? <Text style={styles.token}>Token: {token}</Text> : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  token: { ...typography.caption, color: colors.text.muted, marginVertical: spacing.md },
});
