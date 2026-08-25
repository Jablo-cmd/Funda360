import { useCallback, useEffect, useState } from 'react';
import { attendanceService } from '@/features/attendance/services/attendanceService';
import { calculateAttendanceStats, type AttendanceStats } from '@/features/attendance/utils/calculations';
import type { AttendanceRecord } from '@/features/attendance/types/attendance.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseLearnerAttendanceSummaryResult {
  stats: AttendanceStats | null;
  recentRecords: AttendanceRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const RECENT_RECORDS_LIMIT = 10;

/** One learner's full attendance record set, run through the same calculateAttendanceStats every other attendance view uses — no new calculation logic. */
export function useLearnerAttendanceSummary(learnerId: string | undefined): UseLearnerAttendanceSummaryResult {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRecords(await attendanceService.getAttendanceForLearner(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, "Failed to load this learner's attendance."));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    stats: records.length > 0 ? calculateAttendanceStats(records) : null,
    recentRecords: records.slice(0, RECENT_RECORDS_LIMIT),
    isLoading,
    error,
    refetch: load,
  };
}
