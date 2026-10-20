import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { isDemoMode } from '@/lib/config';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  async function onSubmit() {
    setLoading(true);
    try {
      Alert.alert(isDemoMode ? 'Development environment' : 'Check your email',
        isDemoMode ? 'Password reset emails require Supabase Auth. In demo mode, sign in with the password you created on this device.' : 'If an account exists for that address, a reset link will be sent.');
    } finally { setLoading(false); }
  }
  return (
    <Screen scroll>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.sub}>Enter your account email. Authentication is handled by Supabase Auth once configured.</Text>
      <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Button title="Send reset link" onPress={onSubmit} loading={loading} disabled={!email} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
});
