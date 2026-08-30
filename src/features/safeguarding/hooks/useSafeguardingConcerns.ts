import { useCallback, useEffect, useState } from 'react';
import { safeguardingService } from '@/features/safeguarding/services/safeguardingService';
import type { SafeguardingConcern } from '@/features/safeguarding/types/safeguarding.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseSafeguardingConcernsResult {
  concerns: SafeguardingConcern[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSafeguardingConcerns(learnerId: string | undefined): UseSafeguardingConcernsResult {
  const [concerns, setConcerns] = useState<SafeguardingConcern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setConcerns([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setConcerns(await safeguardingService.getConcernsForLearner(learnerId));
    } catch (err) {
      // A caller without learner.view_safeguarding gets an empty RLS
      // result, not an error — this only ever fires for a real failure
      // (network, etc.), matching every other hook in this codebase.
      setError(getDbErrorMessage(err, 'Failed to load safeguarding concerns.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { concerns, isLoading, error, refetch: load };
}
