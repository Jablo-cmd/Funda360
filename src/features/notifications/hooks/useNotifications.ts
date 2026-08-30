import { useCallback, useEffect, useMemo, useState } from 'react';
import { notificationService } from '@/features/notifications/services/notificationService';
import type { Notification } from '@/features/notifications/types/notification.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(recipientProfileId: string | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!recipientProfileId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setNotifications(await notificationService.getMyNotifications(recipientProfileId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load notifications.'));
    } finally {
      setIsLoading(false);
    }
  }, [recipientProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = useCallback(
    async (id: string) => {
      await notificationService.markRead(id);
      await load();
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    if (!recipientProfileId) return;
    await notificationService.markAllRead(recipientProfileId);
    await load();
  }, [recipientProfileId, load]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  return { notifications, unreadCount, isLoading, error, refetch: load, markRead, markAllRead };
}
