import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { PriceRange } from '@/components/ui/PriceRange';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Professional } from '@/types';
import { colors, spacing, typography } from '@/constants/theme';

export default function RequestServiceScreen() {
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [serviceNeeded, setServiceNeeded] = useState('');
  const [preferredDates, setPreferredDates] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!professionalId) return;
    api.getState().then((state) => setProfessional(state.professionals.find((item) => item.id === professionalId) ?? null));
  }, [professionalId]);
  if (!user || !professionalId) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Request a quote</Text>
      <Text style={styles.sub}>{professional ? professional.name : 'This professional'}</Text>
      {professional ? <PriceRange professional={professional} /> : null}
      <Text style={styles.hint}>Your budget needs to sit inside the published range. Prices are in GBP unless the profile says otherwise.</Text>
      <TextField label="Service needed" value={serviceNeeded} onChangeText={setServiceNeeded} />
      <TextField label="Preferred dates" value={preferredDates} onChangeText={setPreferredDates} placeholder="Next Tuesday morning" />
      <TextField label="Location" value={location} onChangeText={setLocation} placeholder="Bristol, BS6" />
      <TextField label="Budget" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="50" />
      <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <Button title="Send request" loading={loading} onPress={async () => {
        const amount = Number(budget);
        if (!serviceNeeded.trim() || !preferredDates.trim() || !location.trim() || !Number.isFinite(amount)) {
          Alert.alert('Check the form', 'Service, dates, location, and a budget are required.');
          return;
        }
        setLoading(true);
        try {
          await api.createServiceRequest(user.id, { professionalId, serviceNeeded, preferredDates, location, budget: amount, notes: notes.trim() || null });
          Alert.alert('Request sent', 'You can follow the status in Activity.');
          router.back();
        } catch (error) {
          Alert.alert('Could not send', error instanceof Error ? error.message : 'Try again');
        } finally { setLoading(false); }
      }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  sub: { ...typography.bodyMedium, color: colors.text.secondary, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.text.secondary, marginVertical: spacing.md },
});
