import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { MfaEnrollmentCard } from '@/features/mfa/components/MfaEnrollmentCard';
import { privilegedMfaState } from '@/features/mfa/utils/privilegedMfa';

/**
 * Government reporting requires an MFA (aal2) session for education
 * officials and platform administrators. The database refuses their
 * reporting calls without it ("mfa_required"); this guard shows the set-up
 * step instead of an error page. With a factor already enrolled the user is
 * sent to the challenge screen; without one, enrolment is the only thing on
 * the page. Once Supabase Auth upgrades the session to aal2 the guard lets
 * the page through on its own.
 */
export function RequirePrivilegedMfa() {
  const { user, assuranceLevel, hasMfaEnabled } = useAuth();
  const state = privilegedMfaState(user?.role ?? null, assuranceLevel, hasMfaEnabled);

  if (state === 'allowed') return <Outlet />;
  if (state === 'loading') {
    return (
      <PageContainer>
        <LoadingBlock label="Checking your sign-in…" />
      </PageContainer>
    );
  }
  if (state === 'challenge') return <Navigate to="/mfa-challenge" replace />;

  return (
    <PageContainer>
      <PageHeader
        title="Set up two-factor authentication"
        description="Government reporting shows information about many schools and learners. Your role must use two-factor authentication before it can open."
      />
      <div className="max-w-xl">
        <MfaEnrollmentCard />
      </div>
    </PageContainer>
  );
}
