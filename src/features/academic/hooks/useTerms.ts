import { useCallback, useEffect, useState } from 'react';
import { termService } from '@/features/academic/services/termService';
import type { Term } from '@/features/academic/types/academic.types';

export interface UseTermsResult {
  terms: Term[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTerms(academicYearId: string | undefined): UseTermsResult {
  const [terms, setTerms] = useState<Term[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!academicYearId) {
      setTerms([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setTerms(await termService.getTerms(academicYearId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load terms.');
    } finally {
      setIsLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { terms, isLoading, error, refetch: load };
}
