import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, typography } from '@/constants/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  async function onSubmit() {
    if (password.length < 6) { Alert.alert('Password too short', 'Use at least 6 characters.'); return; }
    setLoading(true);
    try { await signUp(email, password, fullName); router.replace('/onboarding'); }
    catch (e) { Alert.alert('Could not register', e instanceof Error ? e.message : 'Please try again'); }
    finally { setLoading(false); }
  }
  return (
    <Screen scroll>
      <Text style={styles.title}>Join LifeCircle</Text>
      <Text style={styles.sub}>Create your account. You will never be required to upload your address book.</Text>
      <TextField label="Full name" value={fullName} onChangeText={setFullName} />
      <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button title="Create account" onPress={onSubmit} loading={loading} disabled={!fullName || !email || !password} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
});
