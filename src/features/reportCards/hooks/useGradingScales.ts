import { useCallback, useEffect, useState } from 'react';
import { gradingScaleService } from '@/features/reportCards/services/gradingScaleService';
import type { GradingScaleWithBands } from '@/features/reportCards/types/reportCard.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseGradingScalesResult {
  scales: GradingScaleWithBands[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGradingScales(schoolId: string | undefined): UseGradingScalesResult {
  const [scales, setScales] = useState<GradingScaleWithBands[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setScales([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setScales(await gradingScaleService.listScales(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load grading scales.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { scales, isLoading, error, refetch: load };
}
