import { useCallback, useEffect, useState } from 'react';
import { gradeService } from '@/features/academic/services/gradeService';
import type { Grade } from '@/features/academic/types/academic.types';

export interface UseGradesResult {
  grades: Grade[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGrades(schoolId: string | undefined): UseGradesResult {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setGrades(await gradeService.getGrades(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load grades.');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { grades, isLoading, error, refetch: load };
}
