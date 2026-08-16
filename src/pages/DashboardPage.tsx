import { Link } from 'react-router-dom';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useLearnersList } from '@/features/learners/hooks/useLearnersList';
import { useEmployeesList } from '@/features/employees/hooks/useEmployeesList';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useUsersList } from '@/features/users/hooks/useUsersList';
import { BriefcaseIcon, BuildingIcon, GraduationCapIcon, LayersIcon, UsersIcon } from '@/components/ui/icons';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  to: string;
  isLoading?: boolean;
}

function StatCard({ label, value, icon: Icon, to, isLoading }: StatCardProps) {
  return (
    <Link
      to={to}
      className="focus-ring flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4 shadow-card transition-colors hover:border-brand-300 dark:shadow-card-dark dark:hover:border-brand-700"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-content-tertiary">{label}</span>
        {isLoading ? (
          <span className="mt-1.5 block h-5 w-12 animate-pulse rounded bg-surface-sunken" aria-hidden="true" />
        ) : (
          <span className="block truncate text-xl font-bold text-content-primary">{value}</span>
        )}
      </span>
    </Link>
  );
}

export function DashboardPage() {
  const { profile } = useProfile();
  const { tenant } = useTenant();
  const { school } = useSchool();
  const { can } = usePermissions();

  const canViewLearners = can('learner.view');
  const canViewEmployees = can('employee.view');
  const canViewAcademic = can('academic.view');
  const canViewUsers = can('profile.view_any');
  const canViewReports = can('reports.view');

  const learners = useLearnersList(canViewLearners ? school?.id : undefined);
  const employees = useEmployeesList(canViewEmployees ? school?.id : undefined);
  const { currentAcademicYear, loading: academicLoading } = useAcademic();
  const users = useUsersList();

  const hasStats = canViewLearners || canViewEmployees || canViewAcademic || canViewUsers;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">
          Welcome back{profile?.firstName ? `, ${profile.firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-content-secondary">
          {profile?.role ? profile.role.replace(/_/g, ' ') : 'No role assigned'}
          {tenant?.school.name ? ` at ${tenant.school.name}` : ''}
        </p>
      </div>

      {hasStats && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canViewLearners && (
            <StatCard
              label="Students"
              value={learners.totalCount}
              icon={GraduationCapIcon}
              to="/learners"
              isLoading={learners.isLoading}
            />
          )}
          {canViewEmployees && (
            <StatCard
              label="Employees"
              value={employees.totalCount}
              icon={BriefcaseIcon}
              to="/employees"
              isLoading={employees.isLoading}
            />
          )}
          {canViewAcademic && (
            <StatCard
              label="Academic year"
              value={currentAcademicYear?.name ?? 'Not set'}
              icon={LayersIcon}
              to="/academic"
              isLoading={academicLoading}
            />
          )}
          {canViewUsers && (
            <StatCard
              label="Users"
              value={users.totalCount}
              icon={UsersIcon}
              to="/users"
              isLoading={users.isLoading}
            />
          )}
        </dl>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {canViewReports && (
          <Link
            to="/reports"
            className="focus-ring flex items-center gap-4 rounded-card border border-border bg-surface-raised p-4 shadow-card transition-colors hover:border-brand-300 dark:shadow-card-dark dark:hover:border-brand-700"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <LayersIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-content-primary">View reports</span>
              <span className="block text-sm text-content-secondary">
                Learner, employee and academic reports for your school.
              </span>
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
