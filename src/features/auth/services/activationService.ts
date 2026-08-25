import { supabase } from '@/lib/supabase';

export type InvitationEffectiveStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface GuardianInvitationContext {
  guardianFirstName: string;
  guardianLastName: string;
  schoolName: string;
  invitationEffectiveStatus: InvitationEffectiveStatus | null;
  children: { id: string; firstName: string; lastName: string }[];
}

/**
 * Reads the invited guardian's own activation context — school name, their
 * name, currently linked children, and the invitation's live status — via
 * get_my_guardian_invitation(). Only callable while holding the temporary
 * Supabase recovery session the invitation email's link establishes (see
 * AuthProvider's PASSWORD_RECOVERY handling); the RPC itself is scoped to
 * auth.uid(), so it can never return another guardian's data.
 */
async function getMyInvitationContext(): Promise<GuardianInvitationContext> {
  const { data, error } = await supabase.rpc('get_my_guardian_invitation');
  if (error) throw error;
  return {
    guardianFirstName: data.guardianFirstName,
    guardianLastName: data.guardianLastName,
    schoolName: data.schoolName,
    invitationEffectiveStatus: data.invitation?.effectiveStatus ?? null,
    children: data.children,
  };
}

/** Marks the invitation accepted — call only after supabase.auth.updateUser({ password }) has already succeeded. */
async function acceptInvitation(): Promise<void> {
  const { error } = await supabase.rpc('accept_guardian_invitation');
  if (error) throw error;
}

export const activationService = {
  getMyInvitationContext,
  acceptInvitation,
};
