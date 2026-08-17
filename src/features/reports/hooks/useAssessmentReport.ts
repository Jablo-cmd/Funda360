import { useCallback, useEffect, useState } from 'react';
import { assessmentReportService } from '@/features/reports/services/assessmentReportService';
import type { AssessmentReportFilters, AssessmentReportContext, AssessmentReport } from '@/features/reports/services/assessmentReportService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAssessmentReportResult {
  data: AssessmentReport | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssessmentReport(
  schoolId: string | undefined,
  filters: AssessmentReportFilters,
  context: AssessmentReportContext,
): UseAssessmentReportResult {
  const [data, setData] = useState<AssessmentReport | null>(null);
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
      setData(await assessmentReportService.getAssessmentReport(schoolId, filters, context));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load assessment report.'));
    } finally {
      setIsLoading(false);
    }
    // context is derived fresh each render from already-loaded hook data;
    // re-keying on its object identity would refetch on every render, so
    // only the primitive filter values and schoolId drive refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, filters.classId, filters.subjectId, filters.termId, filters.academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
