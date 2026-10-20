import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { DemoBanner } from '@/components/ui/DemoBanner';
import { LoadingState } from '@/components/ui/LoadingState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { Message } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';
export default function MessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    if (!user || !id) return;
    try { setMessages(await api.getMessages(id, user.id)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); return api.subscribe(() => { void load(); }); }, [id, user]);
  if (!user) return null;
  if (loading) return <LoadingState />;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <DemoBanner />
      <FlatList data={messages} keyExtractor={(m) => m.id} contentContainerStyle={styles.list} renderItem={({ item }) => {
        const mine = item.sender_id === user.id;
        return <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.bubbleText, mine && styles.mineText]}>{item.body}</Text></View>;
      }} />
      <View style={styles.composer}>
        <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="Write a message" placeholderTextColor={colors.text.muted} />
        <Button title="Send" onPress={async () => { if (!body.trim() || !id) return; await api.sendMessage(id, user.id, body); setBody(''); await load(); }} disabled={!body.trim()} style={{ minWidth: 96 }} />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  list: { padding: spacing.md },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand.purple },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.surface.border },
  bubbleText: { ...typography.body, color: colors.text.primary },
  mineText: { color: colors.text.inverse },
  composer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.surface.border, backgroundColor: colors.surface.card, alignItems: 'center' },
  input: { flex: 1, ...typography.body, backgroundColor: colors.surface.muted, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text.primary },
});
