import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import type { UserRole } from '@/features/auth/types/auth.types';
import { profileService } from '@/features/profile/services/profileService';
import type { ProfileUpdateInput } from '@/features/profile/services/profileService';
import { ProfileContext } from '@/features/profile/context/profileContext';
import type { ProfileContextValue, ProfileLoadStatus } from '@/features/profile/context/profileContext';
import type { UserProfile } from '@/types/profile.types';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [status, setStatus] = useState<ProfileLoadStatus>('idle');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string, role: UserRole | null, emailVerified: boolean) => {
      setStatus('loading');
      setError(null);
      try {
        const row = await profileService.getProfileById(userId);
        if (!row) {
          setStatus('missing');
          setProfile(null);
          return;
        }
        setProfile({ ...row, role, emailVerified });
        setStatus('loaded');
      } catch (err) {
        setStatus('error');
        setProfile(null);
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      }
    },
    [],
  );

  useEffect(() => {
    if (authStatus === 'authenticated' && user) {
      void fetchProfile(user.id, user.role, user.emailVerified);
    } else if (authStatus === 'unauthenticated') {
      setStatus('idle');
      setProfile(null);
      setError(null);
    }
  }, [authStatus, user, fetchProfile]);

  const refetch = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id, user.role, user.emailVerified);
  }, [user, fetchProfile]);

  const updateProfile = useCallback(
    async (updates: ProfileUpdateInput) => {
      if (!user) throw new Error('Cannot update profile: no authenticated user.');
      const row = await profileService.updateProfile(user.id, updates);
      setProfile({ ...row, role: user.role, emailVerified: user.emailVerified });
    },
    [user],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({ status, profile, error, refetch, updateProfile }),
    [status, profile, error, refetch, updateProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
