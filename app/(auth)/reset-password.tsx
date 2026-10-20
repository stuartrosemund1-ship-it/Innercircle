import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { isDemoMode } from '@/lib/config';
import { api } from '@/lib/api';
import { requireSupabase } from '@/lib/supabase/client';
import { clearPasswordRecovery, isPasswordRecovery } from '@/lib/supabase/linking';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const recovery = !isDemoMode && isPasswordRecovery();

  async function onSubmit() {
    setLoading(true);
    try {
      if (isDemoMode) {
        Alert.alert('Development environment', 'Password reset emails require Supabase Auth. In demo mode, sign in with the password you created on this device.');
        return;
      }
      if (recovery) {
        if (password.length < 6) { Alert.alert('Password too short', 'Use at least 6 characters.'); return; }
        const { error } = await requireSupabase().auth.updateUser({ password });
        if (error) throw new Error(error.message);
        clearPasswordRecovery();
        Alert.alert('Password updated', 'You are signed in with your new password.');
        router.replace('/(tabs)');
        return;
      }
      await api.resetPassword(email);
      Alert.alert('Check your email', 'If an account exists for that address, a reset link will be sent.');
    } catch (e) {
      Alert.alert('Could not reset password', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.title}>{recovery ? 'Choose a new password' : 'Reset password'}</Text>
      <Text style={styles.sub}>
        {recovery
          ? 'This reset link signed you in. Set a new password to finish.'
          : 'Enter your account email. Authentication is handled by Supabase Auth once configured.'}
      </Text>
      {recovery
        ? <TextField label="New password" secureTextEntry value={password} onChangeText={setPassword} />
        : <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />}
      <Button title={recovery ? 'Update password' : 'Send reset link'} onPress={onSubmit} loading={loading} disabled={recovery ? password.length < 6 : !email} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
});
