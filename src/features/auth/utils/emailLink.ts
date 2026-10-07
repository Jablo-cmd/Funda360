import type { EmailOtpType } from '@supabase/supabase-js';

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'recovery',
  'invite',
  'signup',
  'magiclink',
  'email_change',
  'email',
];

export interface EmailLinkToken {
  tokenHash: string;
  type: EmailOtpType;
}

/**
 * Reads a `?token_hash=…&type=…` pair from an auth email link.
 *
 * Our email templates link straight to the app with a token hash instead of
 * Supabase's `{{ .ConfirmationURL }}`. The client uses the PKCE flow, so a
 * ConfirmationURL only works in the browser that asked for the email: a
 * guardian invitation is requested from the admin's browser, and a password
 * reset is often opened on a phone. `verifyOtp({ token_hash })` works in any
 * browser.
 */
export function parseEmailLinkToken(search: string): EmailLinkToken | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !EMAIL_OTP_TYPES.includes(type)) return null;
  return { tokenHash, type };
}

/** The same search string without the one-time token, so a reload or shared URL never replays it. */
export function stripEmailLinkToken(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('token_hash');
  params.delete('type');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
