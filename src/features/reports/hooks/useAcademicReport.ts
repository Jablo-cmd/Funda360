import { useCallback, useEffect, useState } from 'react';
import { academicReportService } from '@/features/reports/services/academicReportService';
import type { AcademicReportSummary } from '@/features/reports/types/report.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAcademicReportResult {
  data: AcademicReportSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAcademicReport(schoolId: string | undefined): UseAcademicReportResult {
  const [data, setData] = useState<AcademicReportSummary | null>(null);
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
      setData(await academicReportService.getAcademicReport(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load academic report.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
