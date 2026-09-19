import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { resolveDashboardPersona } from '@/features/dashboard/resolveDashboardPersona';
import { DashboardScreen } from '@/features/dashboard/components/DashboardPrimitives';
import { PrincipalDashboard } from '@/features/dashboard/personas/PrincipalDashboard';
import { PlatformDashboard } from '@/features/dashboard/personas/PlatformDashboard';
import { FinanceDashboard } from '@/features/dashboard/personas/FinanceDashboard';
import { HrDashboard } from '@/features/dashboard/personas/HrDashboard';
import { AdmissionsDashboard } from '@/features/dashboard/personas/AdmissionsDashboard';
import { MinimalDashboard } from '@/features/dashboard/personas/MinimalDashboard';
import { TeacherWorkspacePage } from '@/features/teacherWorkspace/pages/TeacherWorkspacePage';

/**
 * `/dashboard` renders a dashboard composed for the signed-in role — there
 * is no universal dashboard with cards hidden per permission. Guardians and
 * learners never reach here (RedirectGuardiansToParentPortal).
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const persona = resolveDashboardPersona(user?.role ?? null);

  if (persona === 'platform') {
    return <PlatformDashboard />;
  }

  switch (persona) {
    case 'principal':
      return <PrincipalDashboard />;
    case 'teacher':
      return <TeacherWorkspacePage />;
    case 'finance':
      return <FinanceDashboard />;
    case 'hr':
      return <HrDashboard />;
    case 'admissions':
      return <AdmissionsDashboard />;
    case 'minimal':
    default:
      return <MinimalDashboard />;
  }
}
