import { useCallback, useEffect, useState } from 'react';
import { attendanceService } from '@/features/attendance/services/attendanceService';
import type { AttendanceRecord, RosterLearner } from '@/features/attendance/types/attendance.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAttendanceRosterResult {
  roster: RosterLearner[];
  existingRecords: AttendanceRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The class's current roster plus whatever attendance is already recorded for the given date, if the register has already been taken. */
export function useAttendanceRoster(
  classId: string | undefined,
  academicYearId: string | undefined,
  date: string,
): UseAttendanceRosterResult {
  const [roster, setRoster] = useState<RosterLearner[]>([]);
  const [existingRecords, setExistingRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId || !academicYearId) {
      setRoster([]);
      setExistingRecords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [rosterResult, recordsResult] = await Promise.all([
        attendanceService.getClassRoster(classId, academicYearId),
        attendanceService.getAttendanceForClassDate(classId, date),
      ]);
      setRoster(rosterResult);
      setExistingRecords(recordsResult);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the class register.'));
    } finally {
      setIsLoading(false);
    }
  }, [classId, academicYearId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { roster, existingRecords, isLoading, error, refetch: load };
}
