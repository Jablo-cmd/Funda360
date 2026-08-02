import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { BuildingIcon } from '@/components/ui/icons';

export function DashboardPage() {
  const { profile } = useProfile();
  const { tenant, status: tenantStatus } = useTenant();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">
          Welcome back{profile?.firstName ? `, ${profile.firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-content-secondary">
          Here&apos;s a quick look at your Funda360 workspace.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Current role</dt>
          <dd className="mt-1 text-sm font-semibold capitalize text-content-primary">
            {profile?.role ? profile.role.replace(/_/g, ' ') : 'No role assigned'}
          </dd>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Current school</dt>
          <dd className="mt-1 truncate text-sm font-semibold text-content-primary">
            {tenant?.school.name ?? '—'}
          </dd>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-4 shadow-card dark:shadow-card-dark">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Tenant status</dt>
          <dd className="mt-1 text-sm font-semibold capitalize text-content-primary">{tenantStatus}</dd>
        </div>
      </dl>

      {tenant?.school && (
        <Link
          to="/school/profile"
          className="focus-ring flex items-center gap-4 rounded-card border border-border bg-surface-raised p-4 shadow-card transition-colors hover:border-brand-300 dark:shadow-card-dark dark:hover:border-brand-700"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <BuildingIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-content-primary">Manage your school profile</span>
            <span className="block text-sm text-content-secondary">
              Update contact details, address, branding and administration info.
            </span>
          </span>
        </Link>
      )}

      <p className="text-xs text-content-tertiary">
        The rest of the dashboard (students, teachers, reports) lands in upcoming milestones.
      </p>
    </div>
  );
}
