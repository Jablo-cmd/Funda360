import { useCallback, useEffect, useState } from 'react';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import type { Assessment } from '@/features/assessments/types/assessment.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAssessmentResult {
  assessment: Assessment | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssessment(id: string | undefined): UseAssessmentResult {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setAssessment(await assessmentService.getAssessment(id));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the assessment.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assessment, isLoading, error, refetch: load };
}
