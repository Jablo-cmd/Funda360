import { useCallback, useEffect, useState } from 'react';
import { transferService } from '@/features/learners/services/transferService';
import type { LearnerTransfer } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseTransfersResult {
  transfers: LearnerTransfer[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTransfers(learnerId: string | undefined): UseTransfersResult {
  const [transfers, setTransfers] = useState<LearnerTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setTransfers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setTransfers(await transferService.getTransfers(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load transfer history.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { transfers, isLoading, error, refetch: load };
}
