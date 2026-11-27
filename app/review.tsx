import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { colors, spacing, typography } from '@/constants/theme';

export default function ReviewScreen() {
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  if (!user || !professionalId) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>Leave a review</Text>
      <Text style={styles.sub}>Only people who completed a booking, or who were introduced and accepted, can review. One review each.</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => setRating(star)} accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}>
            <Text style={styles.star}>{star <= rating ? '★' : '☆'}</Text>
          </Pressable>
        ))}
      </View>
      <TextField label="Your review" value={body} onChangeText={setBody} multiline placeholder="What was the work like?" />
      <Button title="Publish review" loading={loading} onPress={async () => {
        setLoading(true);
        try {
          await api.createReview(user.id, professionalId, rating, body);
          Alert.alert('Review published', 'People in your circle can see it on the profile.');
          router.back();
        } catch (error) {
          Alert.alert('Could not publish', error instanceof Error ? error.message : 'Try again');
        } finally { setLoading(false); }
      }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginVertical: spacing.md },
  stars: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  star: { fontSize: 32, color: colors.brand.purple },
});
