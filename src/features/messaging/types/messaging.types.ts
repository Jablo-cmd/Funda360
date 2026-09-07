import type { ConversationKind } from '@/lib/database.types';

export interface ConversationParticipantSummary {
  profileId: string;
  firstName: string;
  lastName: string;
  lastReadAt: string | null;
  archived: boolean;
  muted: boolean;
}

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  subject: string | null;
  lastMessageAt: string;
  messageCount: number;
  createdBy: string | null;
  /** The current user's own participant row. */
  myLastReadAt: string | null;
  archived: boolean;
  muted: boolean;
  /** Everyone except the current user. */
  otherParticipants: ConversationParticipantSummary[];
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  /** last message is newer than the user's read cursor and not their own. */
  hasUnread: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderProfileId: string;
  senderName: string;
  body: string;
  isMine: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  attachments: MessageAttachmentSummary[];
}

export interface MessageAttachmentSummary {
  id: string;
  label: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface ConversationThread {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface MessageableProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}
