let pendingInviteToken: string | null = null;

export function setPendingInvite(token: string) { pendingInviteToken = token; }
export function getPendingInvite() { return pendingInviteToken; }
export function clearPendingInvite() { pendingInviteToken = null; }
