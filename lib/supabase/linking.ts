import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';

let passwordRecovery = false;

export function markPasswordRecovery() { passwordRecovery = true; }
export function clearPasswordRecovery() { passwordRecovery = false; }
export function isPasswordRecovery() { return passwordRecovery; }

function readParams(url: string): URLSearchParams {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const queryIndex = url.indexOf('?');
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1).split('#')[0] : '';
  const params = new URLSearchParams(hash);
  const fromQuery = new URLSearchParams(query);
  fromQuery.forEach((value, key) => { if (!params.has(key)) params.set(key, value); });
  return params;
}

async function handleUrl(url: string | null) {
  if (!url || !supabase) return;
  const params = readParams(url);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  if (params.get('type') === 'recovery') markPasswordRecovery();
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) clearPasswordRecovery();
}

/** Completes email links that return to lifecircle:// with an auth session. */
export function listenForAuthLinks() {
  if (!supabase) return () => undefined;
  void Linking.getInitialURL().then((url) => { void handleUrl(url); });
  const subscription = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
  return () => subscription.remove();
}
