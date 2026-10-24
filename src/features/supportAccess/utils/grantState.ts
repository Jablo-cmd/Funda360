import type { PlatformSupportGrantRow, PlatformSupportScope } from '@/lib/database.types';

export const SUPPORT_SCOPES: Array<{ value: PlatformSupportScope; label: string }> = [
  { value: 'safeguarding', label: 'Safeguarding concerns' },
  { value: 'medical', label: 'Medical information' },
  { value: 'behaviour', label: 'Behaviour incidents' },
  { value: 'messages', label: 'Messages' },
];

export const MAX_SUPPORT_HOURS = 72;

/** What a grant means right now. The database stores `approved`; whether it is still open depends on the clock. */
export type GrantState = 'pending' | 'active' | 'expired' | 'declined' | 'revoked';

export function grantState(
  grant: Pick<PlatformSupportGrantRow, 'status' | 'expires_at'>,
  now: Date = new Date(),
): GrantState {
  if (grant.status === 'approved') {
    return grant.expires_at && new Date(grant.expires_at) > now ? 'active' : 'expired';
  }
  return grant.status;
}

export const GRANT_STATE_LABEL: Record<GrantState, string> = {
  pending: 'Waiting for the school',
  active: 'Active',
  expired: 'Expired',
  declined: 'Declined',
  revoked: 'Revoked',
};

export function scopeLabels(scopes: PlatformSupportScope[]): string {
  return scopes
    .map((scope) => SUPPORT_SCOPES.find((s) => s.value === scope)?.label ?? scope)
    .join(', ');
}

/** A grant can still be withdrawn while it is waiting or open. */
export function canRevoke(state: GrantState): boolean {
  return state === 'pending' || state === 'active';
}
