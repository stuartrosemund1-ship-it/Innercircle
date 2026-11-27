import Constants from 'expo-constants';

export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('file:')) return path;
  const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
  const clean = path.replace(/^\//, '');
  return `${base}/${clean}`.replace(/([^:]\/)\/+/g, '$1');
}
