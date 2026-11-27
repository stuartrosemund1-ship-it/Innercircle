import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { isDemoMode } from '@/lib/config';
import { lifeTeamProof } from '@/lib/lifeTeam';
import { colors, radii, spacing, typography } from '@/constants/theme';

export function LifeTeamProofCard({ professionalId, viewerId, isOwner }: { professionalId: string; viewerId: string; isOwner: boolean }) {
  const [copy, setCopy] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getState().then((state) => {
        if (cancelled) return;
        const connectionIds = state.connections.filter((connection) => connection.status === 'accepted' && (connection.requester_id === viewerId || connection.recipient_id === viewerId)).map((connection) => connection.requester_id === viewerId ? connection.recipient_id : connection.requester_id);
        const names: Record<string, string> = {};
        for (const profile of state.profiles) names[profile.id] = profile.full_name;
        const proof = lifeTeamProof(state.lifeTeamSlots, state.lifeTeamPicks, professionalId, connectionIds, names);
        setCopy([
          `#1 for ${proof.firstCount} ${proof.firstCount === 1 ? 'person' : 'people'}, in ${proof.circleCount} ${proof.circleCount === 1 ? 'circle' : 'circles'}`,
          proof.connectionCircleCount ? `In ${proof.connectionCircleCount} of your connections' circles${proof.connectionNames.length ? ` (${proof.connectionNames.join(', ')})` : ''}` : 'Not in your connections’ circles yet',
        ]);
        setDashboard([
          `${proof.circleCount} circles`,
          `${proof.firstCount} #1 spots`,
          `${proof.backupCount} backup spots`,
          proof.trend === 0 ? 'No change in #1 spots this month' : `${proof.trend > 0 ? '+' : ''}${proof.trend} #1 spots versus the previous month`,
          ...proof.byProfession.map((row) => `${row.profession}: ${row.firsts} #1, ${row.backups} backup`),
        ]);
      });
    };
    load();
    const unsubscribe = api.subscribe(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [professionalId, viewerId]);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Life Team</Text>
      {copy.map((line) => <Text key={line} style={styles.body}>{line}</Text>)}
      <Text style={styles.note}>Earned, never bought. A #1 place is chosen by the member. It cannot be paid for.</Text>
      {isOwner || isDemoMode ? (
        <View style={styles.dash}>
          <Text style={styles.label}>{isOwner ? 'Your dashboard' : 'What the professional sees'}</Text>
          {dashboard.map((line) => <Text key={line} style={styles.body}>{line}</Text>)}
          <Text style={styles.note}>These numbers come from members choosing you. There is nothing to buy.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, padding: spacing.md, marginBottom: spacing.sm, gap: 4 },
  label: { ...typography.label, color: colors.text.secondary },
  body: { ...typography.body, color: colors.text.primary },
  note: { ...typography.caption, color: colors.brand.purpleDeep, marginTop: spacing.xs },
  dash: { marginTop: spacing.md, gap: 4 },
});
