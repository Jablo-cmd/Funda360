import { useCallback, useEffect, useState } from 'react';
import { consentService } from '@/features/consent/services/consentService';
import type { ConsentRecord } from '@/features/consent/types/consent.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseConsentRecordsResult {
  records: ConsentRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useConsentRecords(learnerId: string | undefined): UseConsentRecordsResult {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setRecords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRecords(await consentService.getRecordsForLearner(learnerId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load consent records.'));
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { records, isLoading, error, refetch: load };
}
