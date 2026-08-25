import { useCallback, useEffect, useState } from 'react';
import { behaviourService } from '@/features/behaviour/services/behaviourService';
import type { LearnerBehaviourSummary } from '@/features/behaviour/types/behaviour.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseLearnerBehaviourResult {
  summary: LearnerBehaviourSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Pass `learnerId` only when the caller holds learner.view_behaviour — RLS also enforces this independently, but there's no reason to fire a request that will just come back empty/denied. */
export function useLearnerBehaviour(learnerId: string | undefined): UseLearnerBehaviourResult {
  const [summary, setSummary] = useState<LearnerBehaviourSummary | null>(null);
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
      setSummary(await behaviourService.getLearnerBehaviourSummary(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, "Failed to load this learner's behaviour records."));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, isLoading, error, refetch: load };
}
