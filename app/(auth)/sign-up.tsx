import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  async function onSubmit() {
    if (!agreed) { Alert.alert('Agreement needed', 'Please agree to the Terms of Use and Privacy Policy.'); return; }
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
      <Pressable onPress={() => setAgreed((value) => !value)} style={styles.agree}>
        <Text style={styles.agreeText}>{agreed ? '✓' : '○'} I agree to the Terms of Use and Privacy Policy. I am 18 or over.</Text>
      </Pressable>
      <View style={styles.links}>
        <Button title="Terms of Use" variant="ghost" onPress={() => router.push('/legal/terms')} />
        <Button title="Privacy Policy" variant="ghost" onPress={() => router.push('/legal/privacy-policy')} />
      </View>
      <Button title="Create account" onPress={onSubmit} loading={loading} disabled={!fullName || !email || !password || !agreed} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary, marginBottom: spacing.xs },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  agree: { marginBottom: spacing.sm },
  agreeText: { ...typography.body, color: colors.text.primary },
  links: { marginBottom: spacing.sm },
});
