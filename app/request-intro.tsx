import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';

export default function RequestIntroScreen() {
  const { professionalId, intermediaryId } = useLocalSearchParams<{ professionalId: string; intermediaryId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('Would you mind introducing us? I saw your recommendation and would like to connect.');
  const [names, setNames] = useState({ intermediary: '', professional: '' });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!intermediaryId || !professionalId) return;
    api.getState().then((state) => setNames({
      intermediary: state.profiles.find((p) => p.id === intermediaryId)?.full_name ?? 'your connection',
      professional: state.professionals.find((p) => p.id === professionalId)?.name ?? 'this professional',
    }));
  }, [intermediaryId, professionalId]);
  if (!user || !professionalId || !intermediaryId) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Request an introduction</Text>
      <Text style={styles.sub}>Ask {names.intermediary} to introduce you to {names.professional}. They must approve before private contact details are shared.</Text>
      <TextField label="Message" value={message} onChangeText={setMessage} multiline />
      <Button title="Send request" loading={loading} onPress={async () => {
        setLoading(true);
        try {
          const intro = await api.requestIntroduction(user.id, intermediaryId, professionalId, message);
          Alert.alert('Request sent', 'You will be notified when they respond.');
          router.replace(`/intro/${intro.id}`);
        } catch (e) { Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again'); }
        finally { setLoading(false); }
      }} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
});
