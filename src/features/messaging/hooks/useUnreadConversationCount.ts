import { useEffect, useState } from 'react';
import { messagingService } from '@/features/messaging/services/messagingService';

/**
 * Lightweight badge source for the "Messages" nav item. Polls on mount and
 * on an interval — there is no realtime subscription here (the app does not
 * use Supabase Realtime anywhere yet); a message also raises a normal
 * notification, so the header bell is the always-on signal and this is a
 * secondary affordance.
 */
export function useUnreadConversationCount(profileId: string | undefined, pollMs = 60_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    const tick = () => {
      messagingService
        .countUnreadConversations(profileId)
        .then((next) => {
          if (!cancelled) setCount(next);
        })
        .catch(() => {
          /* a transient failure just leaves the last known count */
        });
    };

    tick();
    const id = window.setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [profileId, pollMs]);

  return count;
}
