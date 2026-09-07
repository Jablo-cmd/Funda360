import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useAuth } from '@/features/auth/context/authContext';
import { useConversationThread } from '@/features/messaging/hooks/useConversationThread';
import { getDbErrorMessage } from '@/lib/dbErrors';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface ConversationViewProps {
  conversationId: string;
  onChanged?: () => void;
  onArchived?: () => void;
}

export function ConversationView({ conversationId, onChanged, onArchived }: ConversationViewProps) {
  const { user } = useAuth();
  const { thread, isLoading, error, sendMessage, editMessage, deleteMessage, setArchived, setMuted } =
    useConversationThread(conversationId, user?.id);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  if (isLoading) return <LoadingBlock label="Loading conversation…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!thread) return <ErrorAlert message="Conversation not found." />;

  const { conversation, messages } = thread;
  const title =
    conversation.subject ||
    conversation.otherParticipants.map((p) => `${p.firstName} ${p.lastName}`.trim()).filter(Boolean).join(', ') ||
    'Conversation';

  const handleSend = async () => {
    if (draft.trim().length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await sendMessage(draft.trim());
      setDraft('');
      onChanged?.();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to send.'));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (messageId: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await editMessage(messageId, editDraft.trim());
      setEditingId(null);
      onChanged?.();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to save.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-surface-raised">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-content-primary">{title}</p>
          <p className="text-xs text-content-tertiary">
            {conversation.kind === 'group' ? `${conversation.otherParticipants.length + 1} participants` : 'Direct message'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-sm">
          <button
            type="button"
            className="focus-ring rounded-md px-2 py-1 text-content-secondary hover:bg-surface-sunken"
            onClick={() => void setMuted(!conversation.muted).then(() => onChanged?.())}
          >
            {conversation.muted ? 'Unmute' : 'Mute'}
          </button>
          <button
            type="button"
            className="focus-ring rounded-md px-2 py-1 text-content-secondary hover:bg-surface-sunken"
            onClick={() =>
              void setArchived(!conversation.archived).then(() => {
                if (!conversation.archived) onArchived?.();
                else onChanged?.();
              })
            }
          >
            {conversation.archived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" style={{ maxHeight: '55vh' }}>
        {messages.length === 0 && (
          <li className="text-center text-sm text-content-tertiary">No messages yet.</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className={`flex flex-col gap-1 ${m.isMine ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-card px-3 py-2 text-sm ${
                m.isMine ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-content-primary'
              }`}
            >
              {!m.isMine && <p className="mb-0.5 text-xs font-semibold opacity-80">{m.senderName}</p>}
              {editingId === m.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full rounded-md border border-border-strong bg-surface-raised p-2 text-content-primary"
                    rows={2}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button type="button" className="text-xs underline" onClick={() => void handleSaveEdit(m.id)}>
                      Save
                    </button>
                    <button type="button" className="text-xs underline" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              )}
              {m.attachments.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 text-xs underline">
                  {m.attachments.map((a) => (
                    <li key={a.id}>{a.label}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-content-tertiary">
              <span>{formatDateTime(m.createdAt)}</span>
              {m.editedAt && !m.deletedAt && <span>· edited</span>}
              {m.isMine && !m.deletedAt && editingId !== m.id && (
                <>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditDraft(m.body);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void deleteMessage(m.id).then(() => onChanged?.())}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-border p-3">
        <ErrorAlert message={actionError} />
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-[2.75rem] w-full rounded-md border border-border-strong bg-surface-raised p-2 text-sm text-content-primary"
            rows={2}
            placeholder="Write a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSend();
            }}
          />
          <div className="w-28 shrink-0">
            <Button type="button" onClick={() => void handleSend()} isLoading={busy} disabled={draft.trim().length === 0}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
