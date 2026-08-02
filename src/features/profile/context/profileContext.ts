import { createContext, useContext } from 'react';
import type { ProfileUpdateInput } from '@/features/profile/services/profileService';
import type { UserProfile } from '@/types/profile.types';

export type ProfileLoadStatus = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';

export interface ProfileContextValue {
  status: ProfileLoadStatus;
  profile: UserProfile | null;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: ProfileUpdateInput) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
