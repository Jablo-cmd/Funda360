import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { isPlatformRole } from '@/features/rbac/constants/navigation';
import { useAuth } from '@/features/auth/context/authContext';

/**
 * Shown to a platform role working inside a school they chose with "Switch
 * school": makes it obvious whose data is on screen, that safeguarding,
 * medical, behaviour and message records need the school's approval, and
 * offers the way back to the platform view.
 */
export function PlatformSchoolBanner() {
  const { user } = useAuth();
  const { tenant, leaveTenant } = useTenant();
  const navigate = useNavigate();

  if (!isPlatformRole(user?.role) || !tenant) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-brand-50 px-4 py-2.5 text-sm text-content-primary dark:bg-surface-raised sm:px-6"
    >
      <p className="min-w-0">
        <span className="font-medium">Working inside {tenant.school.name}</span>
        <span className="text-content-secondary">
          {' '}
          as platform staff. Safeguarding, medical, behaviour and message records need the
          school&apos;s <Link to="/support-access">support access approval</Link>.
        </span>
      </p>
      <button
        type="button"
        onClick={() => {
          leaveTenant();
          navigate('/dashboard');
        }}
        className="focus-ring inline-flex min-h-11 shrink-0 items-center rounded-md border border-border-strong bg-surface-raised px-3 text-xs font-medium text-content-primary hover:bg-surface-sunken lg:min-h-9"
      >
        Leave school
      </button>
    </div>
  );
}
