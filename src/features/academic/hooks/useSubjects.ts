import { useCallback, useEffect, useState } from 'react';
import { subjectService } from '@/features/academic/services/subjectService';
import type { Subject } from '@/features/academic/types/academic.types';

export interface UseSubjectsResult {
  subjects: Subject[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSubjects(schoolId: string | undefined): UseSubjectsResult {
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
      setSubjects(await subjectService.getSubjects(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subjects.');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { subjects, isLoading, error, refetch: load };
}
