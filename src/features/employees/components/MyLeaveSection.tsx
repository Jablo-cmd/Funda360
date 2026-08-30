import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useMyLeaveRequests } from '@/features/employees/hooks/useMyLeaveRequests';
import { LeaveRequestFormModal } from '@/features/employees/components/LeaveRequestFormModal';
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_STATUS_STYLES } from '@/features/employees/constants/leaveRequestLabels';

export interface MyLeaveSectionProps {
  schoolId: string;
  employeeId: string;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Self-service leave request submission + own history — no employee.view/manage required, mirroring the self-access RLS clause leave_requests_select/insert already establish. */
export function MyLeaveSection({ schoolId, employeeId }: MyLeaveSectionProps) {
  const { requests, isLoading, error, refetch } = useMyLeaveRequests(employeeId);
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="w-full sm:w-auto sm:min-w-[9rem]">
          <Button type="button" onClick={() => setIsFormOpen(true)}>
            Request leave
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-content-tertiary">Loading your leave requests…</p>
      ) : requests.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised p-4 text-sm text-content-tertiary">
          No leave requests submitted yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {requests.map((request) => (
            <li key={request.id} className="rounded-card border border-border bg-surface-raised p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-content-primary">{LEAVE_TYPE_LABELS[request.leaveType]}</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${LEAVE_STATUS_STYLES[request.status]}`}>
                  {LEAVE_STATUS_LABELS[request.status]}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-content-tertiary">
                {formatDate(request.startDate)} – {formatDate(request.endDate)}
              </p>
              <p className="mt-1.5 text-sm text-content-secondary">{request.reason}</p>
              {request.reviewNotes && (
                <p className="mt-1.5 text-xs text-content-tertiary">Manager note: {request.reviewNotes}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <LeaveRequestFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={schoolId}
        employeeId={employeeId}
        onSaved={() => void refetch()}
      />
    </div>
  );
}
