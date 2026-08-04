import { useCallback, useEffect, useState } from 'react';
import { guardianService } from '@/features/learners/services/guardianService';
import type { LearnerGuardian } from '@/features/learners/types/learner.types';

export interface UseGuardiansResult {
  guardians: LearnerGuardian[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGuardians(learnerId: string | undefined): UseGuardiansResult {
  const [guardians, setGuardians] = useState<LearnerGuardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setGuardians([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setGuardians(await guardianService.getGuardians(learnerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guardians.');
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { guardians, isLoading, error, refetch: load };
}
