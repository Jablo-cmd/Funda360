import { useCallback, useEffect, useState } from 'react';
import { guardianDirectoryService } from '@/features/guardians/services/guardianDirectoryService';
import type { GuardianProfileDetail } from '@/features/guardians/types/guardian.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseGuardianProfileResult {
  guardian: GuardianProfileDetail | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGuardianProfile(guardianProfileId: string | undefined): UseGuardianProfileResult {
  const [guardian, setGuardian] = useState<GuardianProfileDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!guardianProfileId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setGuardian(await guardianDirectoryService.getGuardianProfile(guardianProfileId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load this guardian.'));
    } finally {
      setIsLoading(false);
    }
  }, [guardianProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { guardian, isLoading, error, refetch: load };
}
