import { supabase } from '@/lib/supabase';
import { authService } from '@/features/auth/services/authService';
import { deriveGuardianInvitationDisplayStatus } from '@/features/guardians/utils/guardianInvitationDisplay';
import type { GuardianInvitationRow } from '@/lib/database.types';
import type { GuardianInvitation } from '@/features/guardians/types/guardian.types';

function toGuardianInvitation(row: GuardianInvitationRow): GuardianInvitation {
  return {
    id: row.id,
    guardianProfileId: row.guardian_profile_id,
    status: row.status,
    displayStatus: deriveGuardianInvitationDisplayStatus(row.status, row.expires_at),
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  };
}

/**
 * Sends (or resends) an activation invitation to an existing guardian. Two
 * steps, both required: send_guardian_invitation() records/audits the
 * invitation and supersedes any prior pending one; the RPC has no route to
 * GoTrue's mailer, so the actual email is triggered separately via the
 * same resetPasswordForEmail() mechanism staff password-reset already
 * uses. If the second step fails after the first succeeds, the invitation
 * row still exists in a sendable state — the caller can retry via "Resend
 * Invitation" without creating a duplicate (send_guardian_invitation
 * supersedes, it never stacks).
 */
async function sendInvitation(guardianProfileId: string, guardianEmail: string): Promise<GuardianInvitation> {
  const { data, error } = await supabase.rpc('send_guardian_invitation', {
    p_guardian_profile_id: guardianProfileId,
  });
  if (error) throw error;

  await authService.sendAccountActivationEmail(guardianEmail);

  return toGuardianInvitation(data);
}

async function revokeInvitation(invitationId: string): Promise<GuardianInvitation> {
  const { data, error } = await supabase.rpc('revoke_guardian_invitation', { p_invitation_id: invitationId });
  if (error) throw error;
  return toGuardianInvitation(data);
}

/** Latest invitation per guardian, batch-fetched for a directory listing — avoids one round-trip per row. */
async function getInvitationsForGuardians(guardianProfileIds: string[]): Promise<Map<string, GuardianInvitation>> {
  const byGuardian = new Map<string, GuardianInvitation>();
  if (guardianProfileIds.length === 0) return byGuardian;

  const { data, error } = await supabase
    .from('guardian_invitations')
    .select('*')
    .in('guardian_profile_id', guardianProfileIds)
    .order('created_at', { ascending: false });
  if (error) throw error;

  for (const row of data) {
    if (!byGuardian.has(row.guardian_profile_id)) byGuardian.set(row.guardian_profile_id, toGuardianInvitation(row));
  }
  return byGuardian;
}

async function getInvitationForGuardian(guardianProfileId: string): Promise<GuardianInvitation | null> {
  const result = await getInvitationsForGuardians([guardianProfileId]);
  return result.get(guardianProfileId) ?? null;
}

export const guardianInvitationService = {
  sendInvitation,
  revokeInvitation,
  getInvitationsForGuardians,
  getInvitationForGuardian,
};
