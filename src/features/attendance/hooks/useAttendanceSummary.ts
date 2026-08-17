import { useCallback, useEffect, useState } from 'react';
import { attendanceService } from '@/features/attendance/services/attendanceService';
import type { AttendanceStatusCounts } from '@/features/attendance/types/attendance.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAttendanceSummaryResult {
  counts: AttendanceStatusCounts | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Status breakdown across every class marked for the school on a given date — powers the dashboard's Attendance Overview panel. */
export function useAttendanceSummary(schoolId: string | undefined, date: string): UseAttendanceSummaryResult {
  const [counts, setCounts] = useState<AttendanceStatusCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setCounts(await attendanceService.getSchoolAttendanceSummary(schoolId, date));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load today’s attendance summary.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { counts, isLoading, error, refetch: load };
}
