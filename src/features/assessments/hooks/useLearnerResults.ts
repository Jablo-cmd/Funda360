import { useCallback, useEffect, useState } from 'react';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import type { LearnerAssessmentResult } from '@/features/assessments/types/assessment.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseLearnerResultsResult {
  results: LearnerAssessmentResult[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLearnerResults(learnerId: string | undefined): UseLearnerResultsResult {
  const [results, setResults] = useState<LearnerAssessmentResult[]>([]);
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
      setResults(await assessmentService.getResultsForLearner(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, "Failed to load this learner's assessment results."));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { results, isLoading, error, refetch: load };
}
