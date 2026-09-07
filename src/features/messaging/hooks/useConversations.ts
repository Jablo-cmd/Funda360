import { useCallback, useEffect, useState } from 'react';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { ConversationSummary } from '@/features/messaging/types/messaging.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseConversationsResult {
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useConversations(
  profileId: string | undefined,
  options: { archived?: boolean } = {},
): UseConversationsResult {
  const archived = options.archived ?? false;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setConversations(await messagingService.listConversations(profileId, { archived }));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load conversations.'));
    } finally {
      setIsLoading(false);
    }
  }, [profileId, archived]);

  useEffect(() => {
    void load();
  }, [load]);

  return { conversations, isLoading, error, refetch: load };
}
