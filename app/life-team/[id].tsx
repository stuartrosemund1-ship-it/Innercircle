import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { PriceRange } from '@/components/ui/PriceRange';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { isVerifiedProfessional } from '@/lib/application';
import { EARNED_NEVER_BOUGHT, picksForSlot } from '@/lib/lifeTeam';
import type { LifeTeamAsk, LifeTeamPick, LifeTeamReply, LifeTeamSlot, Professional, Profile } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export default function LifeTeamSlotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [slot, setSlot] = useState<LifeTeamSlot | null>(null);
  const [picks, setPicks] = useState<LifeTeamPick[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ask, setAsk] = useState<LifeTeamAsk | null>(null);
  const [replies, setReplies] = useState<LifeTeamReply[]>([]);
  const [myPick, setMyPick] = useState<Professional | null>(null);
  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    const load = () => {
      api.getState().then((state) => {
        if (cancelled) return;
        const found = state.lifeTeamSlots.find((item) => item.id === id) ?? null;
        setSlot(found);
        setPicks(picksForSlot(state.lifeTeamPicks, id));
        setProfessionals(state.professionals);
        setProfiles(state.profiles);
        const open = state.lifeTeamAsks.find((item) => item.slot_id === id && item.status === 'open') ?? null;
        setAsk(open);
        setReplies(open ? state.lifeTeamReplies.filter((reply) => reply.ask_id === open.id) : []);
        if (found && found.owner_id !== user.id) {
          const ownSlot = state.lifeTeamSlots.find((item) => item.owner_id === user.id && item.profession === found.profession);
          const lead = ownSlot ? state.lifeTeamPicks.find((pick) => pick.slot_id === ownSlot.id && pick.rank === 1) : undefined;
          setMyPick(lead ? state.professionals.find((item) => item.id === lead.professional_id) ?? null : null);
        }
      });
    };
    load();
    const unsubscribe = api.subscribe(load);
    return () => { cancelled = true; unsubscribe(); };
  }, [user, id]);
  if (!user || !id) return null;
  if (!slot) return <Screen><EmptyState title="Slot not found" description="This Life Team place is not on your circle." /></Screen>;
  const mine = slot.owner_id === user.id;
  const pro = (professionalId: string) => professionals.find((item) => item.id === professionalId);
  return (
    <Screen scroll>
      <Text style={styles.title}>{slot.profession}</Text>
      <Text style={styles.note}>{EARNED_NEVER_BOUGHT}</Text>
      {picks.length === 0 ? <Text style={styles.empty}>No {slot.profession.toLowerCase()} yet — ask your circle.</Text> : picks.map((pick) => {
        const professional = pro(pick.professional_id);
        if (!professional) return null;
        return (
          <View key={pick.id} style={styles.card}>
            <Pressable style={styles.row} onPress={() => router.push(`/professional/${professional.id}`)}>
              <Avatar name={professional.name} uri={professional.avatar_url} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{pick.rank === 1 ? '#1' : `Backup ${pick.rank - 1}`} · {professional.name}</Text>
                {isVerifiedProfessional(professional) ? <VerifiedBadge /> : null}
                <PriceRange professional={professional} />
              </View>
            </Pressable>
            {mine ? (
              <View style={styles.actions}>
                <Button title="Move up" variant="secondary" onPress={() => api.moveLifeTeamPick(user.id, slot.id, professional.id, 'up')} style={styles.action} />
                <Button title="Move down" variant="secondary" onPress={() => api.moveLifeTeamPick(user.id, slot.id, professional.id, 'down')} style={styles.action} />
                <Button title="Remove" variant="danger" onPress={() => api.removeLifeTeamPick(user.id, slot.id, professional.id)} style={styles.action} />
              </View>
            ) : null}
          </View>
        );
      })}
      {mine ? (
        <>
          <Button title="Ask my circle" onPress={async () => {
            try { await api.askLifeTeam(user.id, slot.id); Alert.alert('Asked', `Your circle will see “Who's your ${slot.profession.toLowerCase()}?”`); }
            catch (error) { Alert.alert('Could not ask', error instanceof Error ? error.message : 'Try again'); }
          }} />
          <Button title="Browse approved professionals" variant="secondary" onPress={() => router.push({ pathname: '/life-team/browse', params: { profession: slot.profession, slotId: slot.id } })} style={{ marginTop: spacing.sm }} />
        </>
      ) : myPick ? (
        <Button title={`Suggest ${myPick.name}`} onPress={async () => {
          if (!ask) { Alert.alert('No open ask', 'They have not asked your circle about this yet.'); return; }
          try { await api.replyLifeTeamAsk(user.id, ask.id, myPick.id); Alert.alert('Sent', 'They can add your suggestion in one tap.'); }
          catch (error) { Alert.alert('Could not reply', error instanceof Error ? error.message : 'Try again'); }
        }} style={{ marginTop: spacing.md }} />
      ) : <Text style={styles.empty}>You do not have a #1 {slot.profession.toLowerCase()} to suggest.</Text>}
      {mine && replies.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={styles.section}>Replies</Text>
          {replies.map((reply) => {
            const professional = pro(reply.professional_id);
            const person = profiles.find((profile) => profile.id === reply.replier_id);
            if (!professional) return null;
            return (
              <View key={reply.id} style={styles.card}>
                <Text style={styles.name}>{person?.full_name ?? 'A connection'} suggested {professional.name}</Text>
                {reply.note ? <Text style={styles.empty}>{reply.note}</Text> : null}
                <Button title="Add to this slot" onPress={async () => {
                  try { await api.setLifeTeamPick(user.id, slot.id, professional.id, picks.some((pick) => pick.rank === 1) ? undefined : 1); }
                  catch (error) { Alert.alert('Could not add', error instanceof Error ? error.message : 'Try again'); }
                }} />
              </View>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text.primary },
  note: { ...typography.caption, color: colors.brand.purpleDeep, marginVertical: spacing.md },
  empty: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.surface.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  name: { ...typography.bodyMedium, color: colors.text.primary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1 },
  section: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm },
});
