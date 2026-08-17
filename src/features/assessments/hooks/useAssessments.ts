import { useCallback, useEffect, useState } from 'react';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import type { Assessment } from '@/features/assessments/types/assessment.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface AssessmentFilters {
  classId?: string;
  subjectId?: string;
  termId?: string;
  academicYearId?: string;
  limit?: number;
}

export interface UseAssessmentsResult {
  assessments: Assessment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssessments(schoolId: string | undefined, filters: AssessmentFilters): UseAssessmentsResult {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
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
      setAssessments(await assessmentService.getAssessments(schoolId, filters));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load assessments.'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, filters.classId, filters.subjectId, filters.termId, filters.academicYearId, filters.limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assessments, isLoading, error, refetch: load };
}
