import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { appUrl } from '@/lib/appUrl';
import { parseEmailLinkToken, stripEmailLinkToken } from '@/features/auth/utils/emailLink';

async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Captured when this module loads, before React renders: a route redirect
 * such as `/` -> `/dashboard` -> `/login` runs in a child effect, before
 * AuthProvider's own effect, and would drop the query string first.
 */
let pendingEmailLink =
  typeof window === 'undefined' ? null : parseEmailLinkToken(window.location.search);
if (pendingEmailLink) {
  const url = new URL(window.location.href);
  url.search = stripEmailLinkToken(url.search);
  window.history.replaceState(window.history.state, '', url.toString());
}

/**
 * Signs in from an auth email link (`?token_hash=…&type=…`) if the page was
 * opened from one. The token is removed from the address bar on load so a
 * reload or a shared URL never replays it. A recovery token fires
 * PASSWORD_RECOVERY, which AuthProvider routes to /reset-password or leaves
 * on /activate-account. An expired or used token leaves the user signed out,
 * so those pages show their "invalid link" notice.
 */
async function consumeEmailLink(): Promise<void> {
  const token = pendingEmailLink;
  pendingEmailLink = null;
  if (!token) return;
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token.tokenHash,
    type: token.type,
  });
  if (error) throw error;
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
    redirectTo: appUrl('/reset-password'),
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
    redirectTo: appUrl('/activate-account'),
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
  consumeEmailLink,
  signInWithPassword,
  signOut,
  requestPasswordReset,
  sendAccountActivationEmail,
  updatePassword,
  resendVerificationEmail,
};
