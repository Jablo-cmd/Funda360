import { useCallback, useEffect, useState } from 'react';
import { announcementService } from '@/features/announcements/services/announcementService';
import type { Announcement } from '@/features/announcements/types/announcement.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAnnouncementsResult {
  announcements: Announcement[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAnnouncements(schoolId: string | undefined): UseAnnouncementsResult {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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
      setAnnouncements(await announcementService.getAnnouncements(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load announcements.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { announcements, isLoading, error, refetch: load };
}
