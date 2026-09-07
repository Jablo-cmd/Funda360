import { supabase } from '@/lib/supabase';
import type {
  ConversationKind,
  ConversationRow,
  MessageRow,
  MessageAttachmentRow,
} from '@/lib/database.types';
import type {
  ConversationMessage,
  ConversationSummary,
  ConversationThread,
  MessageableProfile,
} from '@/features/messaging/types/messaging.types';

interface ParticipantJoinRow {
  conversation_id: string;
  profile_id: string;
  last_read_at: string | null;
  archived: boolean;
  muted: boolean;
  profiles: { id: string; first_name: string; last_name: string } | null;
}

function nameOf(p: { first_name: string; last_name: string } | null | undefined): string {
  if (!p) return 'Unknown';
  return `${p.first_name} ${p.last_name}`.trim();
}

/**
 * Conversations the current user participates in, newest activity first.
 * RLS (conversations_select / conversation_participants_select) already
 * restricts every row here to threads the caller is a participant of — the
 * profile_id filter is for query efficiency, not the security boundary.
 */
async function listConversations(
  profileId: string,
  options: { archived?: boolean } = {},
): Promise<ConversationSummary[]> {
  const archived = options.archived ?? false;

  const { data: mine, error: mineError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at, archived, muted')
    .eq('profile_id', profileId)
    .eq('archived', archived);
  if (mineError) throw mineError;
  if (!mine || mine.length === 0) return [];

  const ids = mine.map((r) => r.conversation_id);
  const myRowByConversation = new Map(mine.map((r) => [r.conversation_id, r]));

  const [{ data: conversations, error: convError }, { data: participants, error: partError }, { data: lastMessages, error: msgError }] =
    await Promise.all([
      supabase.from('conversations').select('*').in('id', ids),
      supabase
        .from('conversation_participants')
        .select('conversation_id, profile_id, last_read_at, archived, muted, profiles(id, first_name, last_name)')
        .in('conversation_id', ids),
      supabase
        .from('messages')
        .select('conversation_id, body, sender_profile_id, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false }),
    ]);
  if (convError) throw convError;
  if (partError) throw partError;
  if (msgError) throw msgError;

  const participantsByConversation = new Map<string, ParticipantJoinRow[]>();
  for (const row of (participants ?? []) as unknown as ParticipantJoinRow[]) {
    const list = participantsByConversation.get(row.conversation_id) ?? [];
    list.push(row);
    participantsByConversation.set(row.conversation_id, list);
  }

  const lastMessageByConversation = new Map<string, { body: string; sender_profile_id: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, m);
    }
  }

  const summaries: ConversationSummary[] = (conversations ?? []).map((conv: ConversationRow) => {
    const myRow = myRowByConversation.get(conv.id);
    const others = (participantsByConversation.get(conv.id) ?? []).filter((p) => p.profile_id !== profileId);
    const last = lastMessageByConversation.get(conv.id) ?? null;
    const myLastReadAt = myRow?.last_read_at ?? null;
    const hasUnread =
      !!last &&
      last.sender_profile_id !== profileId &&
      (myLastReadAt === null || new Date(last.created_at) > new Date(myLastReadAt));

    return {
      id: conv.id,
      kind: conv.kind,
      subject: conv.subject,
      lastMessageAt: conv.last_message_at,
      messageCount: conv.message_count,
      createdBy: conv.created_by,
      myLastReadAt,
      archived: myRow?.archived ?? false,
      muted: myRow?.muted ?? false,
      otherParticipants: others.map((p) => ({
        profileId: p.profile_id,
        firstName: p.profiles?.first_name ?? '',
        lastName: p.profiles?.last_name ?? '',
        lastReadAt: p.last_read_at,
        archived: p.archived,
        muted: p.muted,
      })),
      lastMessagePreview: last ? last.body : null,
      lastMessageSenderId: last ? last.sender_profile_id : null,
      hasUnread,
    };
  });

  summaries.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  return summaries;
}

/** Count of conversations with at least one message the user has not read. */
async function countUnreadConversations(profileId: string): Promise<number> {
  const conversations = await listConversations(profileId, { archived: false });
  return conversations.filter((c) => c.hasUnread).length;
}

async function getThread(conversationId: string, profileId: string): Promise<ConversationThread> {
  const [summary, { data: messages, error: msgError }, { data: attachments, error: attError }] = await Promise.all([
    listConversations(profileId, { archived: false }).then((all) => all.find((c) => c.id === conversationId)),
    supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
    supabase.from('message_attachments').select('*').eq('conversation_id', conversationId),
  ]);
  if (msgError) throw msgError;
  if (attError) throw attError;

  let conversation = summary;
  if (!conversation) {
    // Archived or brand-new — fall back to the archived list, then a direct fetch.
    conversation = (await listConversations(profileId, { archived: true })).find((c) => c.id === conversationId);
  }
  if (!conversation) {
    const { data, error } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
    if (error) throw error;
    conversation = {
      id: data.id,
      kind: data.kind,
      subject: data.subject,
      lastMessageAt: data.last_message_at,
      messageCount: data.message_count,
      createdBy: data.created_by,
      myLastReadAt: null,
      archived: false,
      muted: false,
      otherParticipants: [],
      lastMessagePreview: null,
      lastMessageSenderId: null,
      hasUnread: false,
    };
  }

  const nameByProfile = new Map<string, string>();
  for (const p of conversation.otherParticipants) {
    nameByProfile.set(p.profileId, `${p.firstName} ${p.lastName}`.trim());
  }

  const attachmentsByMessage = new Map<string, MessageAttachmentRow[]>();
  for (const a of attachments ?? []) {
    const list = attachmentsByMessage.get(a.message_id) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.message_id, list);
  }

  const threadMessages: ConversationMessage[] = (messages ?? []).map((m: MessageRow) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderProfileId: m.sender_profile_id,
    senderName: m.sender_profile_id === profileId ? 'You' : nameByProfile.get(m.sender_profile_id) ?? 'Unknown',
    body: m.body,
    isMine: m.sender_profile_id === profileId,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
    createdAt: m.created_at,
    attachments: (attachmentsByMessage.get(m.id) ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      storagePath: a.storage_path,
      mimeType: a.mime_type,
      sizeBytes: a.size_bytes,
    })),
  }));

  return { conversation, messages: threadMessages };
}

async function startConversation(input: {
  participantProfileIds: string[];
  body: string;
  subject?: string | null;
  kind?: ConversationKind;
}): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', {
    p_participant_profile_ids: input.participantProfileIds,
    p_body: input.body,
    p_subject: input.subject ?? null,
    p_kind: input.kind ?? 'direct',
  });
  if (error) throw error;
  return (data as ConversationRow).id;
}

async function sendMessage(conversationId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('send_message', { p_conversation_id: conversationId, p_body: body });
  if (error) throw error;
}

async function editMessage(messageId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('edit_message', { p_message_id: messageId, p_body: body });
  if (error) throw error;
}

async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_message', { p_message_id: messageId });
  if (error) throw error;
}

async function markRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  if (error) throw error;
}

async function setFlags(
  conversationId: string,
  flags: { archived?: boolean; muted?: boolean },
): Promise<void> {
  const { error } = await supabase.rpc('set_conversation_flags', {
    p_conversation_id: conversationId,
    p_archived: flags.archived ?? null,
    p_muted: flags.muted ?? null,
  });
  if (error) throw error;
}

async function addParticipants(conversationId: string, profileIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('add_conversation_participants', {
    p_conversation_id: conversationId,
    p_profile_ids: profileIds,
  });
  if (error) throw error;
}

/**
 * Profiles in the tenant the current user might start a conversation with,
 * matched by name/email. The server (can_message_profile, enforced inside
 * start_conversation) has the final say on whether a given target is
 * allowed — this list is a convenience, not an authorization decision.
 */
async function searchMessageableProfiles(query: string, excludeProfileId: string): Promise<MessageableProfile[]> {
  const trimmed = query.trim();
  let request = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, status')
    .eq('status', 'active')
    .neq('id', excludeProfileId)
    .order('last_name', { ascending: true })
    .limit(20);
  if (trimmed.length > 0) {
    request = request.or(
      `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`,
    );
  }
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: p.email,
  }));
}

export const messagingService = {
  listConversations,
  countUnreadConversations,
  getThread,
  startConversation,
  sendMessage,
  editMessage,
  deleteMessage,
  markRead,
  setFlags,
  addParticipants,
  searchMessageableProfiles,
  nameOf,
};
