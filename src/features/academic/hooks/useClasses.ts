import { useCallback, useEffect, useState } from 'react';
import { classService } from '@/features/academic/services/classService';
import type { Class } from '@/features/academic/types/academic.types';

export interface UseClassesResult {
  classes: Class[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useClasses(schoolId: string | undefined): UseClassesResult {
  const [classes, setClasses] = useState<Class[]>([]);
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
      setClasses(await classService.getClasses(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load classes.');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { classes, isLoading, error, refetch: load };
}
