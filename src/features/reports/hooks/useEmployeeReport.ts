import { useCallback, useEffect, useState } from 'react';
import { employeeReportService } from '@/features/reports/services/employeeReportService';
import type { EmployeeReportSummary } from '@/features/reports/types/report.types';

export interface UseEmployeeReportResult {
  data: EmployeeReportSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployeeReport(schoolId: string | undefined): UseEmployeeReportResult {
  const [data, setData] = useState<EmployeeReportSummary | null>(null);
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
      setData(await employeeReportService.getEmployeeReport(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee report.');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
