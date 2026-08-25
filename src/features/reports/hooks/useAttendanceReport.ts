import { useCallback, useEffect, useState } from 'react';
import { attendanceReportService } from '@/features/reports/services/attendanceReportService';
import type {
  AttendanceReportFilters,
  AttendanceReportContext,
  AttendanceReport,
} from '@/features/reports/services/attendanceReportService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAttendanceReportResult {
  data: AttendanceReport | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAttendanceReport(
  schoolId: string | undefined,
  filters: AttendanceReportFilters,
  context: AttendanceReportContext,
): UseAttendanceReportResult {
  const [data, setData] = useState<AttendanceReport | null>(null);
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
      setData(await attendanceReportService.getAttendanceReport(schoolId, filters, context));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the attendance report.'));
    } finally {
      setIsLoading(false);
    }
    // context is derived fresh each render from already-loaded hook data;
    // re-keying on its object identity would refetch on every render, so
    // only the primitive filter values and schoolId drive refetches —
    // matching useAssessmentReport's identical reasoning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, filters.startDate, filters.endDate, filters.classId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
