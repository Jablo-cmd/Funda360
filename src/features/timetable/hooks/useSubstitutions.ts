import { useCallback, useEffect, useState } from 'react';
import { substitutionService } from '@/features/timetable/services/substitutionService';
import type { TimetableSubstitution } from '@/features/timetable/types/substitution.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseSubstitutionsResult {
  substitutions: TimetableSubstitution[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSubstitutions(schoolId: string | undefined): UseSubstitutionsResult {
  const [substitutions, setSubstitutions] = useState<TimetableSubstitution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setSubstitutions([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setSubstitutions(await substitutionService.getSubstitutions(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load substitute-teacher assignments.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { substitutions, isLoading, error, refetch: load };
}
