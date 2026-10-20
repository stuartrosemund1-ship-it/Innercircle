import { useState } from 'react';
import { Alert, StyleSheet, Text, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { colors, spacing, typography } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  async function onSubmit() {
    setLoading(true);
    try { await signIn(email, password); router.replace('/(tabs)'); }
    catch (e) { Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Please try again'); }
    finally { setLoading(false); }
  }
  return (
    <Screen scroll>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.sub}>Sign in to continue building your circle.</Text>
      <TextField label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} autoComplete="email" />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="password" />
      <Button title="Sign in" onPress={onSubmit} loading={loading} disabled={!email || !password} />
      <Link href="/(auth)/reset-password" asChild><Pressable style={styles.linkWrap}><Text style={styles.link}>Forgot password?</Text></Pressable></Link>
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  linkWrap: { marginTop: spacing.md, alignItems: 'center' },
  link: { ...typography.bodyMedium, color: colors.brand.purple },
});
