import { useEffect, useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useLeaveRequests } from '@/features/employees/hooks/useLeaveRequests';
import { staffAttendanceService } from '@/features/employees/services/staffAttendanceService';
import { ReviewLeaveRequestDialog } from '@/features/employees/components/ReviewLeaveRequestDialog';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_STATUS_STYLES } from '@/features/employees/constants/leaveRequestLabels';
import type { LeaveRequest, LeaveRequestStatus } from '@/features/employees/types/leaveRequest.types';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { Button } from '@/components/ui/Button';

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_FILTER_OPTIONS: { value: LeaveRequestStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** HR/management view of every leave request for the school (FND-HR-004) — review (approve/reject) is gated on employee.manage, matching leave_requests_update's own can_manage_employees()-only RLS policy. */
export function LeaveRequestsPage() {
  const { can } = usePermissions();
  const canManage = can('employee.manage');
  const { school } = useSchool();
  const { requests, isLoading, error, refetch } = useLeaveRequests(school?.id);

  const [employeeNamesById, setEmployeeNamesById] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | ''>('pending');
  const [reviewTarget, setReviewTarget] = useState<LeaveRequest | null>(null);

  useEffect(() => {
    if (!school) return;
    void staffAttendanceService.getStaffRoster(school.id).then((roster) => {
      setEmployeeNamesById(Object.fromEntries(roster.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`])));
    });
  }, [school]);

  const filteredRequests = useMemo(
    () => (statusFilter ? requests.filter((request) => request.status === statusFilter) : requests),
    [requests, statusFilter],
  );

  return (
    <PageContainer>
      <PageHeader title="Leave Requests" description="Review staff leave requests for your school." />

      {school && (
        <div className="flex items-center gap-3">
          <label htmlFor="leave-status-filter" className="text-sm font-medium text-content-secondary">
            Status
          </label>
          <select
            id="leave-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LeaveRequestStatus | '')}
            className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-56"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <ErrorAlert message={error} />

      {!school ? (
        <NoActiveSchoolNotice resource="leave requests" />
      ) : isLoading ? (
        <LoadingBlock label="Loading leave requests…" />
      ) : filteredRequests.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No leave requests match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredRequests.map((request) => (
            <li key={request.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-content-primary">
                      {employeeNamesById[request.employeeId] ?? 'Employee'}
                    </p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${LEAVE_STATUS_STYLES[request.status]}`}>
                      {LEAVE_STATUS_LABELS[request.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-content-tertiary">
                    {LEAVE_TYPE_LABELS[request.leaveType]} · {formatDate(request.startDate)} – {formatDate(request.endDate)}
                  </p>
                  <p className="mt-2 text-sm text-content-secondary">{request.reason}</p>
                  {request.reviewNotes && <p className="mt-1.5 text-xs text-content-tertiary">Note: {request.reviewNotes}</p>}
                </div>
                {canManage && request.status === 'pending' && (
                  <div className="w-full sm:w-auto sm:min-w-[9rem]">
                    <Button type="button" variant="secondary" onClick={() => setReviewTarget(request)}>
                      Review
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewTarget && (
        <ReviewLeaveRequestDialog
          isOpen
          onClose={() => setReviewTarget(null)}
          request={reviewTarget}
          employeeName={employeeNamesById[reviewTarget.employeeId] ?? 'Employee'}
          onReviewed={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}
