import { useCallback, useEffect, useRef, useState } from 'react';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { ConversationThread } from '@/features/messaging/types/messaging.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseConversationThreadResult {
  thread: ConversationThread | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  setArchived: (archived: boolean) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
}

export function useConversationThread(
  conversationId: string | undefined,
  profileId: string | undefined,
): UseConversationThreadResult {
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markedReadFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId || !profileId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await messagingService.getThread(conversationId, profileId);
      setThread(next);
      if (markedReadFor.current !== conversationId) {
        markedReadFor.current = conversationId;
        await messagingService.markRead(conversationId);
      }
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load this conversation.'));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, profileId]);

  useEffect(() => {
    markedReadFor.current = null;
    void load();
  }, [load]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!conversationId) return;
      await messagingService.sendMessage(conversationId, body);
      await load();
    },
    [conversationId, load],
  );

  const editMessage = useCallback(
    async (messageId: string, body: string) => {
      await messagingService.editMessage(messageId, body);
      await load();
    },
    [load],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      await messagingService.deleteMessage(messageId);
      await load();
    },
    [load],
  );

  const setArchived = useCallback(
    async (archived: boolean) => {
      if (!conversationId) return;
      await messagingService.setFlags(conversationId, { archived });
      await load();
    },
    [conversationId, load],
  );

  const setMuted = useCallback(
    async (muted: boolean) => {
      if (!conversationId) return;
      await messagingService.setFlags(conversationId, { muted });
      await load();
    },
    [conversationId, load],
  );

  return { thread, isLoading, error, refetch: load, sendMessage, editMessage, deleteMessage, setArchived, setMuted };
}
