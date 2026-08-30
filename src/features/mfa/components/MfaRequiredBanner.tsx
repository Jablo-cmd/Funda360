import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';
import { isMfaRequiredForRole } from '@/features/rbac/constants/mfaRequiredRoles';

/**
 * Soft nudge, not a block — see mfaRequiredRoles.ts for why hard
 * enforcement is deliberately deferred. Renders nothing for a role that
 * doesn't need MFA, or for anyone who already has it enabled — so it's
 * safe to mount unconditionally at the top of every staff page.
 *
 * Reads hasMfaEnabled straight from AuthContext (already resolved before
 * ProtectedRoute renders the protected tree at all — see its own comment)
 * rather than running its own separate useMfaFactors() fetch. That's not
 * just an optimization: a banner that pops in a beat after first paint
 * shifts the whole page's layout down, which is a real, disruptive
 * cumulative-layout-shift for anyone already interacting with the page
 * (confirmed the hard way — it raced and broke a real e2e click before
 * this fix).
 */
export function MfaRequiredBanner() {
  const { user, hasMfaEnabled } = useAuth();

  if (hasMfaEnabled !== false || !isMfaRequiredForRole(user?.role ?? null)) {
    return null;
  }

  return (
    // Deliberately no role="status"/"alert" — those ARIA live-region roles
    // signal a transient announcement, which collides with every page's
    // own (genuinely transient) success/error message using the same role
    // ("banner" is persistent chrome, not a one-off notification; a screen
    // reader user reaches it by regular content navigation instead).
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning-500/30 bg-warning-50 px-4 py-2.5 text-sm text-warning-600 dark:bg-warning-500/10 dark:text-warning-500 sm:px-6">
      <span>Your role requires two-factor authentication. Set it up to keep your account secure.</span>
      <Link to="/my-profile#mfa-security" className="focus-ring rounded font-semibold underline hover:no-underline">
        Set up now
      </Link>
    </div>
  );
}
