import { useCallback, useEffect, useState } from 'react';
import { userService } from '@/features/users/services/userService';
import type { Profile } from '@/types/profile.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseUserProfileResult {
  user: Profile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserProfile(userId: string | undefined): UseUserProfileResult {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await userService.getUserById(userId);
      setUser(result);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load user.'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { user, isLoading, error, refetch: load };
}
