import { useCallback, useEffect, useState } from 'react';
import { behaviourService } from '@/features/behaviour/services/behaviourService';
import type { GuardianVisibleBehaviourIncident } from '@/features/behaviour/types/behaviour.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseGuardianVisibleBehaviourResult {
  incidents: GuardianVisibleBehaviourIncident[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Parent Portal only — reads through get_guardian_visible_behaviour_incidents(), never the raw behaviour_incidents table. */
export function useGuardianVisibleBehaviour(learnerId: string | undefined): UseGuardianVisibleBehaviourResult {
  const [incidents, setIncidents] = useState<GuardianVisibleBehaviourIncident[]>([]);
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
      setIncidents(await behaviourService.getGuardianVisibleIncidents(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, "Failed to load this learner's behaviour records."));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { incidents, isLoading, error, refetch: load };
}
