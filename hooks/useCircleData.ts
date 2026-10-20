import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Connection, IntroductionRequest, PersonalTrust, Professional, ProfessionalRecommendation, Profile, AppNotification } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export function useCircleData() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [recommendations, setRecommendations] = useState<ProfessionalRecommendation[]>([]);
  const [personalTrusts, setPersonalTrusts] = useState<PersonalTrust[]>([]);
  const [introductions, setIntroductions] = useState<IntroductionRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setError(null);
    try {
      const [conns, recs, intros, notifs, state] = await Promise.all([
        api.listConnections(user.id), api.getVisibleRecommendations(user.id),
        api.listIntroductions(user.id), api.listNotifications(user.id), api.getState(),
      ]);
      setConnections(conns); setRecommendations(recs); setIntroductions(intros); setNotifications(notifs);
      setPersonalTrusts(state.personalTrusts.filter((t) => t.user_id === user.id));
      const acceptedIds = new Set<string>();
      for (const c of conns) {
        if (c.status !== 'accepted') continue;
        acceptedIds.add(c.requester_id === user.id ? c.recipient_id : c.requester_id);
      }
      setPeople(state.profiles.filter((p) => acceptedIds.has(p.id)));
      const proIds = new Set<string>([
        ...recs.map((r) => r.professional_id),
        ...state.personalTrusts.filter((t) => t.user_id === user.id).map((t) => t.professional_id),
        ...state.professionals.filter((p) => p.created_by === user.id).map((p) => p.id),
      ]);
      setProfessionals(state.professionals.filter((p) => proIds.has(p.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load circle data');
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    void refresh();
    return api.subscribe(() => { void refresh(); });
  }, [refresh]);

  const pendingIncoming = connections.filter((c) => c.status === 'pending' && user && c.recipient_id === user.id);
  return { connections, people, professionals, recommendations, personalTrusts, introductions, notifications, pendingIncoming, loading, error, refresh };
}
