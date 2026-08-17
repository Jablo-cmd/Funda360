import { Link } from 'react-router-dom';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useLearnersList } from '@/features/learners/hooks/useLearnersList';
import { useEmployeesList } from '@/features/employees/hooks/useEmployeesList';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useUsersList } from '@/features/users/hooks/useUsersList';
import { useAttendanceSummary } from '@/features/attendance/hooks/useAttendanceSummary';
import { useAssessments } from '@/features/assessments/hooks/useAssessments';
import { BriefcaseIcon, BuildingIcon, ChartIcon, CheckIcon, GraduationCapIcon } from '@/components/ui/icons';

/** Zero-pads to a fixed instrument-display width, then groups thousands — e.g. 1284 -> "01,284". */
function formatStat(n: number): string {
  return Math.max(0, Math.round(n)).toString().padStart(5, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface StatPanelProps {
  label: string;
  value: ReactNode;
  caption: string;
  to: string;
  isLoading?: boolean;
}

function StatPanel({ label, value, caption, to, isLoading }: StatPanelProps) {
  return (
    <Link
      to={to}
      className="focus-ring flex flex-col gap-1.5 rounded-card border border-border bg-surface-raised px-4 py-3.5 transition-colors hover:border-brand-400 dark:hover:border-brand-500"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{label}</span>
      {isLoading ? (
        <span className="block h-7 w-20 animate-pulse rounded bg-surface-sunken" aria-hidden="true" />
      ) : (
        <span className="font-mono text-2xl font-semibold leading-none text-content-primary">{value}</span>
      )}
      <span className="text-xs text-content-tertiary">{caption}</span>
    </Link>
  );
}

interface StatusRowProps {
  label: string;
  status: 'online' | 'degraded';
}

function StatusRow({ label, status }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-content-secondary">{label}</span>
      <span
        className={
          status === 'online'
            ? 'flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-success-500'
            : 'flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-warning-600 dark:text-warning-500'
        }
      >
        <span
          aria-hidden="true"
          className={status === 'online' ? 'h-1.5 w-1.5 rounded-full bg-success-500' : 'h-1.5 w-1.5 rounded-full bg-warning-500'}
        />
        {status === 'online' ? 'Online' : 'Degraded'}
      </span>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface-raised p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-content-tertiary">{title}</h2>
      {children}
    </section>
  );
}

function NotYetAvailable({ message }: { message: string }) {
  return (
    <p className="flex h-full min-h-[5.5rem] items-center justify-center text-center text-xs text-content-tertiary">
      {message}
    </p>
  );
}

interface QuickAction {
  label: string;
  description: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
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
  const canViewAttendance = can('attendance.view');
  const canViewAssessments = can('assessment.view');

  const learners = useLearnersList(canViewLearners ? school?.id : undefined);
  const employees = useEmployeesList(canViewEmployees ? school?.id : undefined);
  const { currentAcademicYear, loading: academicLoading, error: academicError } = useAcademic();
  const users = useUsersList();
  const attendance = useAttendanceSummary(canViewAttendance ? school?.id : undefined, todayIsoDate());
  const recentAssessments = useAssessments(canViewAssessments ? school?.id : undefined, { limit: 3 });
  const { classes: assessmentClasses } = useClasses(canViewAssessments ? school?.id : undefined);

  const hasStats = canViewLearners || canViewEmployees || canViewAcademic || canViewUsers;

  const quickActions: QuickAction[] = [
    ...(canViewLearners
      ? [{ label: 'Learners', description: 'View and manage the learner roster.', to: '/learners', icon: GraduationCapIcon }]
      : []),
    ...(canViewEmployees
      ? [{ label: 'Employees', description: 'View and manage staff records.', to: '/employees', icon: BriefcaseIcon }]
      : []),
    ...(canViewAttendance
      ? [{ label: 'Attendance', description: 'Take or review a class register.', to: '/attendance', icon: CheckIcon }]
      : []),
    ...(canViewAssessments
      ? [{ label: 'Assessments', description: 'Create assessments and enter marks.', to: '/academic/assessments', icon: ChartIcon }]
      : []),
    ...(canViewReports
      ? [{ label: 'Reports', description: 'Learner, employee and academic reports.', to: '/reports', icon: ChartIcon }]
      : []),
    { label: 'School Profile', description: 'Contact details, address and branding.', to: '/school/profile', icon: BuildingIcon },
  ];

  return (
    <div className="flex flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold text-content-primary">
          Welcome back{profile?.firstName ? `, ${profile.firstName}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-content-secondary">
          {profile?.role ? profile.role.replace(/_/g, ' ') : 'No role assigned'}
          {tenant?.school.name ? ` at ${tenant.school.name}` : ''}
        </p>
      </div>

      {hasStats && (
        <div>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
            Executive Summary
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canViewLearners && (
              <StatPanel
                label="Active Learners"
                value={formatStat(learners.totalCount)}
                caption="Current enrolment"
                to="/learners"
                isLoading={learners.isLoading}
              />
            )}
            {canViewEmployees && (
              <StatPanel
                label="Active Employees"
                value={formatStat(employees.totalCount)}
                caption="Current staff complement"
                to="/employees"
                isLoading={employees.isLoading}
              />
            )}
            {canViewAcademic && (
              <StatPanel
                label="Academic Year"
                value={currentAcademicYear?.name ?? '—'}
                caption={currentAcademicYear ? 'Currently active' : 'None set as active'}
                to="/academic"
                isLoading={academicLoading}
              />
            )}
            {canViewUsers && (
              <StatPanel
                label="System Users"
                value={formatStat(users.totalCount)}
                caption="Registered accounts"
                to="/users"
                isLoading={users.isLoading}
              />
            )}
          </dl>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel title="Attendance Overview">
          {!canViewAttendance ? (
            <NotYetAvailable message="You don't have access to attendance records." />
          ) : attendance.isLoading ? (
            <div className="flex h-full min-h-[5.5rem] items-center justify-center">
              <span
                aria-hidden="true"
                className="h-6 w-6 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
              />
              <span className="sr-only">Loading today's attendance…</span>
            </div>
          ) : attendance.counts && attendance.counts.present + attendance.counts.absent + attendance.counts.late > 0 ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="font-mono text-2xl font-semibold text-success-500">
                  {formatStat(attendance.counts.present)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Present</span>
              </div>
              <div>
                <span className="font-mono text-2xl font-semibold text-danger-600">
                  {formatStat(attendance.counts.absent)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Absent</span>
              </div>
              <div>
                <span className="font-mono text-2xl font-semibold text-warning-600 dark:text-warning-500">
                  {formatStat(attendance.counts.late)}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-content-tertiary">Late</span>
              </div>
            </div>
          ) : (
            <NotYetAvailable message="No attendance recorded for today yet." />
          )}
        </InfoPanel>

        <InfoPanel title="System Status">
          <div>
            <StatusRow label="Authentication" status="online" />
            {canViewAcademic && <StatusRow label="Academic Services" status={academicError ? 'degraded' : 'online'} />}
            {canViewAttendance && <StatusRow label="Attendance Records" status={attendance.error ? 'degraded' : 'online'} />}
            {canViewLearners && <StatusRow label="Learner Registry" status={learners.error ? 'degraded' : 'online'} />}
            {canViewEmployees && <StatusRow label="Employee Registry" status={employees.error ? 'degraded' : 'online'} />}
            {canViewUsers && <StatusRow label="User Directory" status={users.error ? 'degraded' : 'online'} />}
          </div>
        </InfoPanel>

        <InfoPanel title={canViewAssessments ? 'Recent Assessments' : 'Recent Activity'}>
          {!canViewAssessments ? (
            <NotYetAvailable message="Activity history is not yet available in this workspace." />
          ) : recentAssessments.isLoading ? (
            <div className="flex h-full min-h-[5.5rem] items-center justify-center">
              <span
                aria-hidden="true"
                className="h-6 w-6 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
              />
              <span className="sr-only">Loading recent assessments…</span>
            </div>
          ) : recentAssessments.assessments.length === 0 ? (
            <NotYetAvailable message="No assessments have been created yet." />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recentAssessments.assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  to={`/academic/assessments/${assessment.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-300"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-content-primary">{assessment.title}</span>
                    <span className="block truncate text-xs text-content-tertiary">
                      {assessmentClasses.find((c) => c.id === assessment.classId)?.name ?? 'Class'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-content-tertiary">
                    {new Date(`${assessment.assessmentDate}T00:00:00`).toLocaleDateString('en-ZA', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </InfoPanel>

        <InfoPanel title="Quick Actions">
          <div className="flex flex-col divide-y divide-border">
            {quickActions.map(({ label, description, to, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="focus-ring flex items-center gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-300"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-content-primary">{label}</span>
                  <span className="block truncate text-xs text-content-tertiary">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </InfoPanel>
      </div>
    </div>
  );
}
