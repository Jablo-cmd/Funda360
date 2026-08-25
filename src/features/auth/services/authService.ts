import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function signInWithPassword(email: string, password: string): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/**
 * Delivers a guardian's account-activation link. Same Supabase recovery
 * mechanism as requestPasswordReset (no new email infrastructure), just
 * redirecting to /activate-account instead of /reset-password — see
 * AuthProvider's PASSWORD_RECOVERY handler for how the two routes stay
 * distinct despite sharing one underlying flow. Called by
 * guardianInvitationService right after send_guardian_invitation() records
 * the invitation — that RPC has no route to GoTrue's mailer itself.
 */
async function sendAccountActivationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/activate-account`,
  });
  if (error) throw error;
}

async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

export const authService = {
  getSession,
  signInWithPassword,
  signOut,
  requestPasswordReset,
  sendAccountActivationEmail,
  updatePassword,
  resendVerificationEmail,
};
