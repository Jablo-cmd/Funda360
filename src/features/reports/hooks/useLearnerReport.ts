import { useCallback, useEffect, useState } from 'react';
import { learnerReportService } from '@/features/reports/services/learnerReportService';
import type { LearnerReportSummary } from '@/features/reports/types/report.types';

export interface UseLearnerReportResult {
  data: LearnerReportSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLearnerReport(schoolId: string | undefined): UseLearnerReportResult {
  const [data, setData] = useState<LearnerReportSummary | null>(null);
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
      setData(await learnerReportService.getLearnerReport(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learner report.');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
