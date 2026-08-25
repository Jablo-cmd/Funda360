import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import type { AttendanceStats } from '@/features/attendance/utils/calculations';

export interface AttendanceSummaryCardProps {
  stats: AttendanceStats | null;
  isLoading: boolean;
  error: string | null;
}

export function AttendanceSummaryCard({ stats, isLoading, error }: AttendanceSummaryCardProps) {
  return (
    <Card title="Attendance">
      {isLoading ? (
        <LoadingBlock label="Loading attendance summary…" compact />
      ) : error ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : !stats ? (
        <p className="text-sm text-content-tertiary">No attendance recorded for this learner yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-mono text-2xl font-semibold text-content-primary">
            {stats.attendanceRate === null ? '—' : `${stats.attendanceRate}%`}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-content-tertiary">Present</dt>
              <dd className="font-mono font-medium text-success-500">{stats.present}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Absent</dt>
              <dd className="font-mono font-medium text-danger-600">{stats.absent}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Late</dt>
              <dd className="font-mono font-medium text-warning-600 dark:text-warning-500">{stats.late}</dd>
            </div>
            <div>
              <dt className="text-xs text-content-tertiary">Excused</dt>
              <dd className="font-mono font-medium text-brand-600 dark:text-brand-300">{stats.excused}</dd>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
