import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { PriceRange } from '@/components/ui/PriceRange';
import { isVerifiedProfessional } from '@/lib/application';
import { EARNED_NEVER_BOUGHT, emptySlotCopy, primaryPick } from '@/lib/lifeTeam';
import type { LifeTeamPick, LifeTeamSlot, Professional } from '@/types';
import { colors, radii, spacing, typography } from '@/constants/theme';

export function LifeTeamGrid({ slots, picks, professionals, onOpen, onAdd }: {
  slots: LifeTeamSlot[];
  picks: LifeTeamPick[];
  professionals: Professional[];
  onOpen: (slotId: string) => void;
  onAdd: () => void;
}) {
  return (
    <View>
      <Text style={styles.note}>{EARNED_NEVER_BOUGHT}</Text>
      <View style={styles.grid}>
        {slots.map((slot) => {
          const lead = primaryPick(picks, slot.id);
          const professional = lead ? professionals.find((item) => item.id === lead.professional_id) : undefined;
          const backups = picks.filter((pick) => pick.slot_id === slot.id && pick.rank > 1).length;
          return (
            <Pressable key={slot.id} style={styles.slot} onPress={() => onOpen(slot.id)}>
              {professional ? (
                <>
                  <Avatar name={professional.name} uri={professional.avatar_url} size={52} />
                  <Text style={styles.role}>{slot.profession}</Text>
                  <Text style={styles.name} numberOfLines={1}>{professional.name}</Text>
                  {isVerifiedProfessional(professional) ? <VerifiedBadge /> : null}
                  <PriceRange professional={professional} />
                  <Text style={styles.rank}>#1{backups ? ` · ${backups} backup${backups === 1 ? '' : 's'}` : ''}</Text>
                </>
              ) : (
                <>
                  <View style={styles.emptyMark}><Text style={styles.plus}>+</Text></View>
                  <Text style={styles.role}>{slot.profession}</Text>
                  <Text style={styles.empty}>{emptySlotCopy(slot.profession)}</Text>
                </>
              )}
            </Pressable>
          );
        })}
        <Pressable style={[styles.slot, styles.add]} onPress={onAdd}>
          <View style={styles.emptyMark}><Text style={styles.plus}>+</Text></View>
          <Text style={styles.role}>Add a slot</Text>
          <Text style={styles.empty}>A custom profession, still chosen by you.</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.caption, color: colors.brand.purpleDeep, backgroundColor: colors.brand.purpleSoft, padding: spacing.sm, borderRadius: radii.md, overflow: 'hidden', marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { width: '48%', flexGrow: 1, backgroundColor: colors.surface.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.surface.border, padding: spacing.md, alignItems: 'center', gap: 4, minHeight: 168 },
  add: { borderStyle: 'dashed' },
  role: { ...typography.label, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs },
  name: { ...typography.bodyMedium, color: colors.text.primary, textAlign: 'center' },
  rank: { ...typography.caption, color: colors.brand.teal },
  empty: { ...typography.caption, color: colors.text.muted, textAlign: 'center' },
  emptyMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  plus: { ...typography.h2, color: colors.brand.purple },
});
