import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import { learnerService } from '@/features/learners/services/learnerService';
import type { Learner } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseMyLearnersResult {
  data: Learner[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyLearners(): UseMyLearnersResult {
  const { user } = useAuth();
  const [data, setData] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await learnerService.getMyLearners());
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load your linked learners.'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
