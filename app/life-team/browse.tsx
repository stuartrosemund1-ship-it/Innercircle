import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { PriceRange } from '@/components/ui/PriceRange';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isApprovedProfessional, isVerifiedProfessional } from '@/lib/application';
import { matchesRole } from '@/lib/lifeTeam';
import type { Professional } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function BrowseLifeTeamScreen() {
  const { profession, slotId } = useLocalSearchParams<{ profession: string; slotId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<{ professional: Professional; connectionNames: string[] }[]>([]);
  useEffect(() => {
    if (!user || !profession) return;
    api.getState().then((state) => {
      const names = new Map(state.profiles.map((profile) => [profile.id, profile.full_name]));
      const connectionIds = state.connections.filter((connection) => connection.status === 'accepted' && (connection.requester_id === user.id || connection.recipient_id === user.id)).map((connection) => connection.requester_id === user.id ? connection.recipient_id : connection.requester_id);
      const approved = state.professionals.filter((professional) => isApprovedProfessional(professional) && matchesRole(professional, profession));
      setRows(approved.map((professional) => {
        const holders = state.lifeTeamPicks.filter((pick) => pick.rank === 1 && pick.professional_id === professional.id).map((pick) => state.lifeTeamSlots.find((slot) => slot.id === pick.slot_id)).filter((slot) => slot && connectionIds.includes(slot.owner_id));
        const connectionNames = holders.map((slot) => names.get(slot!.owner_id) ?? 'A connection');
        return { professional, connectionNames };
      }));
    });
  }, [user, profession]);
  if (!user || !profession || !slotId) return null;
  return (
    <Screen scroll>
      <Text style={styles.title}>{profession}</Text>
      <Text style={styles.sub}>Approved professionals only. A #1 spot is earned, never bought. Names show which of your connections already chose them as #1.</Text>
      {rows.length === 0 ? <Text style={styles.muted}>No approved {profession.toLowerCase()} yet.</Text> : rows.map(({ professional, connectionNames }) => (
        <Pressable key={professional.id} style={styles.card} onPress={() => router.push(`/professional/${professional.id}`)}>
          <View style={styles.row}>
            <Avatar name={professional.name} uri={professional.avatar_url} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{professional.name}</Text>
              {isVerifiedProfessional(professional) ? <VerifiedBadge /> : null}
              <PriceRange professional={professional} />
              <Text style={styles.muted}>{connectionNames.length ? `#1 for ${connectionNames.join(', ')}` : 'Not a #1 in your circle yet'}</Text>
            </View>
          </View>
          <Pressable onPress={async () => {
            try { await api.setLifeTeamPick(user.id, slotId, professional.id); router.back(); }
            catch (error) { Alert.alert('Could not add', error instanceof Error ? error.message : 'Try again'); }
          }}><Text style={styles.add}>Add to this slot</Text></Pressable>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary },
  sub: { ...typography.body, color: colors.text.secondary, marginVertical: spacing.md },
  muted: { ...typography.caption, color: colors.text.secondary },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  name: { ...typography.bodyMedium, color: colors.text.primary },
  add: { ...typography.label, color: colors.brand.purple },
});
