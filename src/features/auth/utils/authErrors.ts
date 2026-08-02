import { AuthApiError, AuthError, isAuthError } from '@supabase/supabase-js';

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please verify your email address before signing in.',
  over_email_send_rate_limit: 'Too many requests. Please wait a moment and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  user_not_found: 'No account found with that email address.',
  weak_password: 'Please choose a stronger password (at least 8 characters).',
  same_password: 'Your new password must be different from your current password.',
  session_not_found: 'Your session has expired. Please sign in again.',
};

/** Maps Supabase auth errors to copy safe to show end users. */
export function getAuthErrorMessage(error: unknown): string {
  if (isAuthError(error) || error instanceof AuthError || error instanceof AuthApiError) {
    const code = (error as AuthError & { code?: string }).code;
    if (code && MESSAGES_BY_CODE[code]) {
      return MESSAGES_BY_CODE[code];
    }
    if (/network|fetch/i.test(error.message)) {
      return 'Network error. Check your connection and try again.';
    }
    return error.message || 'Something went wrong. Please try again.';
  }

  if (error instanceof Error) return error.message;

  return 'Something went wrong. Please try again.';
}
