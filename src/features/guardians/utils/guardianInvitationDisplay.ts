import type { GuardianInvitationStatus } from '@/lib/database.types';
import type { GuardianInvitationDisplayStatus } from '@/features/guardians/types/guardian.types';

/**
 * 'expired' has no stored value in guardian_invitations.status (see the
 * guardian_invitation_status enum's comment in the migration) — it's
 * derived by comparing a 'pending' row's expiresAt to the current time,
 * same computation get_my_guardian_invitation() does server-side. Kept as
 * its own pure function (rather than inlined in the service) so the
 * derivation itself is unit-testable independent of any Supabase call.
 */
export function deriveGuardianInvitationDisplayStatus(
  status: GuardianInvitationStatus,
  expiresAt: string,
  now: Date = new Date(),
): GuardianInvitationDisplayStatus {
  if (status === 'pending' && new Date(expiresAt).getTime() < now.getTime()) return 'expired';
  return status;
}
