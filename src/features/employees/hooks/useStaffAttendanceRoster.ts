import { useCallback, useEffect, useState } from 'react';
import { staffAttendanceService } from '@/features/employees/services/staffAttendanceService';
import type { StaffAttendanceRecord, RosterEmployee } from '@/features/employees/types/staffAttendance.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseStaffAttendanceRosterResult {
  roster: RosterEmployee[];
  existingRecords: StaffAttendanceRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The school's active-employee roster plus whatever staff attendance is already recorded for the given date — mirrors useAttendanceRoster's own shape exactly. */
export function useStaffAttendanceRoster(schoolId: string | undefined, date: string): UseStaffAttendanceRosterResult {
  const [roster, setRoster] = useState<RosterEmployee[]>([]);
  const [existingRecords, setExistingRecords] = useState<StaffAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setRoster([]);
      setExistingRecords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [rosterResult, recordsResult] = await Promise.all([
        staffAttendanceService.getStaffRoster(schoolId),
        staffAttendanceService.getAttendanceForDate(schoolId, date),
      ]);
      setRoster(rosterResult);
      setExistingRecords(recordsResult);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the staff register.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { roster, existingRecords, isLoading, error, refetch: load };
}
