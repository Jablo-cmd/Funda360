import { useCallback, useEffect, useState } from 'react';
import { interventionService } from '@/features/learners/services/interventionService';
import type { AcademicIntervention } from '@/features/learners/types/intervention.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseInterventionsResult {
  interventions: AcademicIntervention[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useInterventions(learnerId: string | undefined): UseInterventionsResult {
  const [interventions, setInterventions] = useState<AcademicIntervention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setInterventions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setInterventions(await interventionService.getInterventions(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load academic interventions.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { interventions, isLoading, error, refetch: load };
}
