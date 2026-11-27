import type { LifeTeamPick, LifeTeamSlot, Professional } from '@/types';

export const LIFE_TEAM_ROLES = [
  'Plumber', 'Electrician', 'Builder', 'Mechanic', 'Accountant', 'Solicitor',
  'Financial adviser', 'GP/Doctor', 'Dentist', 'Personal trainer', 'Estate agent', 'Cleaner',
] as const;

export type LifeTeamRole = (typeof LIFE_TEAM_ROLES)[number];

export const EARNED_NEVER_BOUGHT = 'Earned, never bought. You choose your #1. It cannot be paid for.';

export function emptySlotCopy(profession: string): string {
  const label = profession.toLowerCase();
  return `No ${label} yet — ask your circle`;
}

export function picksForSlot(picks: LifeTeamPick[], slotId: string): LifeTeamPick[] {
  return picks.filter((pick) => pick.slot_id === slotId).sort((a, b) => a.rank - b.rank);
}

export function primaryPick(picks: LifeTeamPick[], slotId: string): LifeTeamPick | undefined {
  return picksForSlot(picks, slotId).find((pick) => pick.rank === 1);
}

export interface LifeTeamProof {
  firstCount: number;
  circleCount: number;
  backupCount: number;
  connectionCircleCount: number;
  connectionNames: string[];
  byProfession: { profession: string; firsts: number; backups: number }[];
  trend: number;
}

export function lifeTeamProof(
  slots: LifeTeamSlot[],
  picks: LifeTeamPick[],
  professionalId: string,
  connectionIds: string[],
  names: Record<string, string>,
): LifeTeamProof {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const related = picks.filter((pick) => pick.professional_id === professionalId && slotById.has(pick.slot_id));
  const owners = new Set(related.map((pick) => slotById.get(pick.slot_id)!.owner_id));
  const firsts = related.filter((pick) => pick.rank === 1);
  const backups = related.filter((pick) => pick.rank > 1);
  const connectionOwners = [...owners].filter((ownerId) => connectionIds.includes(ownerId));
  const byProfession = new Map<string, { firsts: number; backups: number }>();
  for (const pick of related) {
    const profession = slotById.get(pick.slot_id)!.profession;
    const row = byProfession.get(profession) ?? { firsts: 0, backups: 0 };
    if (pick.rank === 1) row.firsts += 1;
    else row.backups += 1;
    byProfession.set(profession, row);
  }
  const month = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recent = firsts.filter((pick) => now - new Date(pick.created_at).getTime() <= month).length;
  const previous = firsts.filter((pick) => {
    const age = now - new Date(pick.created_at).getTime();
    return age > month && age <= month * 2;
  }).length;
  return {
    firstCount: firsts.length,
    circleCount: owners.size,
    backupCount: backups.length,
    connectionCircleCount: connectionOwners.length,
    connectionNames: connectionOwners.map((id) => names[id] ?? 'A connection'),
    byProfession: [...byProfession.entries()].map(([profession, counts]) => ({ profession, ...counts })),
    trend: recent - previous,
  };
}

export function matchesRole(professional: Pick<Professional, 'life_role' | 'category'>, profession: string): boolean {
  if (professional.life_role === profession) return true;
  const category = professional.category.toLowerCase();
  const role = profession.toLowerCase();
  if (role === 'personal trainer' && category.includes('fitness')) return true;
  if (role === 'accountant' && category.includes('accountant')) return true;
  if (role === 'solicitor' && category.includes('lawyer')) return true;
  if (role === 'financial adviser' && category.includes('financial')) return true;
  if ((role === 'gp/doctor' || role === 'dentist') && category.includes('health')) return true;
  if (role === 'cleaner' && category.includes('cleaner')) return true;
  if (role === 'plumber' && category.includes('plumber')) return true;
  if (role === 'electrician' && category.includes('electrician')) return true;
  if (role === 'builder' && category.includes('home maintenance')) return true;
  if (role === 'mechanic' && category.includes('mechanic')) return true;
  if (role === 'estate agent' && category.includes('other')) return true;
  return false;
}
