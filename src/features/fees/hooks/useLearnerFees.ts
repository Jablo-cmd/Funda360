import { useCallback, useEffect, useState } from 'react';
import { feeService } from '@/features/fees/services/feeService';
import type { LearnerFeeSummary } from '@/features/fees/types/fee.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseLearnerFeesResult {
  summary: LearnerFeeSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Pass `learnerId` only when the caller holds learner.view_financial — RLS also enforces this independently, but there's no reason to fire a request that will just come back empty/denied. */
export function useLearnerFees(learnerId: string | undefined): UseLearnerFeesResult {
  const [summary, setSummary] = useState<LearnerFeeSummary | null>(null);
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
      setSummary(await feeService.getLearnerFeeSummary(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, "Failed to load this learner's fee information."));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, isLoading, error, refetch: load };
}
