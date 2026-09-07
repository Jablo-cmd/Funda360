import type { ConversationSummary } from '@/features/messaging/types/messaging.types';

/**
 * Human label for a conversation row: its subject if set, otherwise the
 * other participants' names (truncated for groups). Pure — no I/O — so it
 * is unit-tested directly.
 */
export function conversationTitle(conversation: Pick<ConversationSummary, 'subject' | 'otherParticipants'>): string {
  if (conversation.subject && conversation.subject.trim().length > 0) {
    return conversation.subject.trim();
  }
  const names = conversation.otherParticipants
    .map((p) => `${p.firstName} ${p.lastName}`.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) return 'Conversation';
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

/**
 * A conversation has unread content for the current user when its latest
 * message is newer than their read cursor and was not sent by them. Mirrors
 * the server's own "unread" definition (send_message advances the sender's
 * cursor immediately).
 */
export function conversationHasUnread(params: {
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  myLastReadAt: string | null;
  myProfileId: string;
}): boolean {
  const { lastMessageAt, lastMessageSenderId, myLastReadAt, myProfileId } = params;
  if (!lastMessageAt || !lastMessageSenderId) return false;
  if (lastMessageSenderId === myProfileId) return false;
  if (myLastReadAt === null) return true;
  return new Date(lastMessageAt).getTime() > new Date(myLastReadAt).getTime();
}

/** Compact timestamp for a conversation list row: time today, else day + month. */
export function formatConversationTime(value: string, now: Date = new Date()): string {
  const d = new Date(value);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}
