import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useLearnerAttendanceSummary } from '@/features/attendance/hooks/useLearnerAttendanceSummary';

export interface ChildAttendanceTabProps {
  learnerId: string;
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ChildAttendanceTab({ learnerId }: ChildAttendanceTabProps) {
  const { stats, recentRecords, isLoading, error } = useLearnerAttendanceSummary(learnerId);

  if (isLoading) {
    return <LoadingBlock label="Loading attendance…" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert message={error} />

      {!stats ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No attendance records yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-card border border-border bg-surface-raised p-4 text-center">
              <p className="text-2xl font-bold text-content-primary">
                {stats.attendanceRate !== null ? `${stats.attendanceRate}%` : '—'}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-content-tertiary">Attendance rate</p>
            </div>
            {(['present', 'absent', 'late', 'excused'] as const).map((key) => (
              <div key={key} className="rounded-card border border-border bg-surface-raised p-4 text-center">
                <p className="text-2xl font-bold text-content-primary">{stats[key]}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-content-tertiary">{STATUS_LABELS[key]}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-content-primary">Recent attendance</h3>
            {recentRecords.length === 0 ? (
              <p className="text-sm text-content-tertiary">No recent records.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between rounded-card border border-border bg-surface-raised px-4 py-3"
                  >
                    <span className="text-sm text-content-primary">{formatDate(record.attendanceDate)}</span>
                    <span className="text-sm font-medium capitalize text-content-secondary">{record.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
