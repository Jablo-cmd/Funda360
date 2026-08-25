import { useCallback, useEffect, useState } from 'react';
import { guardianSelfService } from '@/features/parentPortal/services/guardianSelfService';
import type { MyGuardianProfile } from '@/features/parentPortal/services/guardianSelfService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseMyGuardianProfileResult {
  profile: MyGuardianProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyGuardianProfile(): UseMyGuardianProfileResult {
  const [profile, setProfile] = useState<MyGuardianProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setProfile(await guardianSelfService.getMyProfile());
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load your profile.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, isLoading, error, refetch: load };
}
