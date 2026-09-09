import { Link } from 'react-router-dom';
import { useProfile } from '@/features/profile/context/profileContext';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useEmployeesList } from '@/features/employees/hooks/useEmployeesList';
import { useLeaveRequests } from '@/features/employees/hooks/useLeaveRequests';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { BriefcaseIcon, CalendarIcon, CheckIcon, LayersIcon } from '@/components/ui/icons';
import {
  DashboardHeading,
  DashboardScreen,
  EmptyPanelMessage,
  InfoPanel,
  QuickActionsPanel,
  StatPanel,
  type QuickAction,
} from '@/features/dashboard/components/DashboardPrimitives';
import { formatStat } from '@/features/dashboard/utils';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  family_responsibility: 'Family responsibility',
  maternity: 'Maternity leave',
  paternity: 'Paternity leave',
  study: 'Study leave',
  unpaid: 'Unpaid leave',
  other: 'Other',
};

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

/** HR workspace dashboard — HR manager. */
export function HrDashboard() {
  const { profile } = useProfile();
  const { tenant } = useTenant();
  const { school } = useSchool();

  const employees = useEmployeesList(school?.id);
  const leave = useLeaveRequests(school?.id);
  const pending = leave.requests.filter((r) => r.status === 'pending');

  const quickActions: QuickAction[] = [
    { label: 'Employees', description: 'Staff records and onboarding.', to: '/employees', icon: BriefcaseIcon },
    { label: 'Leave Requests', description: 'Review and decide leave.', to: '/employees/leave', icon: CalendarIcon },
    { label: 'Staff Attendance', description: "Today's staff register.", to: '/employees/attendance', icon: CheckIcon },
    { label: 'Departments', description: 'Structure and department heads.', to: '/employees/departments', icon: LayersIcon },
  ];

  return (
    <DashboardScreen>
      <DashboardHeading
        title={`Welcome back${profile?.firstName ? `, ${profile.firstName}` : ''}`}
        subtitle={`Human Resources${tenant?.school.name ? ` · ${tenant.school.name}` : ''}`}
      />

      {!school ? (
        <NoActiveSchoolNotice resource="the HR workspace" />
      ) : (
        <>
          <ErrorAlert message={employees.error ?? leave.error} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatPanel
              label="Active Employees"
              value={formatStat(employees.totalCount)}
              caption="Current staff complement"
              to="/employees"
              isLoading={employees.isLoading}
            />
            <StatPanel
              label="Pending Leave"
              value={formatStat(pending.length)}
              caption="Requests awaiting a decision"
              to="/employees/leave"
              isLoading={leave.isLoading}
            />
            <StatPanel
              label="Leave Requests"
              value={formatStat(leave.requests.length)}
              caption="All requests this school"
              to="/employees/leave"
              isLoading={leave.isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoPanel title="Leave Awaiting Review">
              {leave.isLoading ? (
                <EmptyPanelMessage message="Loading leave requests…" />
              ) : pending.length === 0 ? (
                <EmptyPanelMessage message="No leave requests awaiting review." />
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {pending.slice(0, 6).map((r) => (
                    <Link
                      key={r.id}
                      to="/employees/leave"
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 last:pb-0 hover:text-brand-600 dark:hover:text-brand-300"
                    >
                      <span className="text-sm font-medium text-content-primary">
                        {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-content-tertiary">
                        {fmtDate(r.startDate)} – {fmtDate(r.endDate)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </InfoPanel>

            <QuickActionsPanel actions={quickActions} />
          </div>
        </>
      )}
    </DashboardScreen>
  );
}
