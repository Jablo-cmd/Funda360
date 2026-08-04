import { useCallback, useEffect, useState } from 'react';
import { learnerService } from '@/features/learners/services/learnerService';
import type { Learner } from '@/features/learners/types/learner.types';

export interface UseLearnerResult {
  learner: Learner | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLearner(learnerId: string | undefined): UseLearnerResult {
  const [learner, setLearner] = useState<Learner | null>(null);
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
      setLearner(await learnerService.getLearner(learnerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learner.');
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { learner, isLoading, error, refetch: load };
}
