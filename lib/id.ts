export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
export function nowIso(): string { return new Date().toISOString(); }
export async function hashToken(token: string): Promise<string> {
  let h = 0;
  for (let i = 0; i < token.length; i += 1) { h = (h << 5) - h + token.charCodeAt(i); h |= 0; }
  return `h_${Math.abs(h).toString(16)}_${token.length}`;
}
