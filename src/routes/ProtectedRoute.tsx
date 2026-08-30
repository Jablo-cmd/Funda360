import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';

/** Gate for routes that require a signed-in, email-verified user who has completed any pending MFA step-up challenge. */
export function ProtectedRoute() {
  const { status, user, mfaChallengePending } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <FullScreenSpinner label="Loading your session…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  // mfaChallengePending starts null while AuthProvider resolves the
  // assurance level after a fresh sign-in (a local, no-network check —
  // see AuthProvider.applySession — so this resolves in well under a
  // frame, not a real loading delay). Waiting for it here, rather than
  // letting the protected tree render first and patch the answer in
  // later, is deliberate: MfaRequiredBanner (mounted on every dashboard
  // page for qualifying roles) would otherwise pop in a beat after first
  // paint and shift the whole page's layout down, which is both bad UX
  // (a real cumulative-layout-shift) and was observed to race real clicks
  // in e2e tests against elements the shift moved out from under them.
  if (mfaChallengePending === null) {
    return <FullScreenSpinner label="Loading your session…" />;
  }

  if (mfaChallengePending) {
    return <Navigate to="/mfa-challenge" replace />;
  }

  return <Outlet />;
}
