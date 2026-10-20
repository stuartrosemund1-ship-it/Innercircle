import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Profile } from '@/types';

interface AuthContextValue {
  user: Profile | null; loading: boolean; refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<Profile>) => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const session = await api.getSession();
    setUser(session.user);
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try { const session = await api.getSession(); if (mounted) setUser(session.user); }
      finally { if (mounted) setLoading(false); }
    })();
    const unsub = api.subscribe(() => { void refresh(); });
    return () => { mounted = false; unsub(); };
  }, [refresh]);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading, refresh,
    async signIn(email, password) { setUser(await api.signIn(email, password)); },
    async signUp(email, password, fullName) { setUser(await api.signUp(email, password, fullName)); },
    async signOut() { await api.signOut(); setUser(null); },
    async updateUser(patch) { if (!user) return; setUser(await api.updateProfile(user.id, patch)); },
  }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
