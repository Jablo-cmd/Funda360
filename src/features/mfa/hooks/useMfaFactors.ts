import { useCallback, useEffect, useState } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { mfaService } from '@/features/mfa/services/mfaService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseMfaFactorsResult {
  factors: Factor[];
  verifiedFactor: Factor | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMfaFactors(): UseMfaFactorsResult {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setFactors(await mfaService.listFactors());
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load your two-factor authentication status.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { factors, verifiedFactor: factors.find((f) => f.status === 'verified') ?? null, isLoading, error, refetch: load };
}
