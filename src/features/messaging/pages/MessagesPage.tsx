import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useAuth } from '@/features/auth/context/authContext';
import { useConversations } from '@/features/messaging/hooks/useConversations';
import { ConversationView } from '@/features/messaging/components/ConversationView';
import { NewConversationModal } from '@/features/messaging/components/NewConversationModal';
import { conversationTitle, formatConversationTime } from '@/features/messaging/utils/conversationDisplay';

export interface MessagesPageProps {
  /** '/messages' for staff, '/parent/messages' for guardians. */
  basePath?: string;
}

export function MessagesPage({ basePath = '/messages' }: MessagesPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [showArchived, setShowArchived] = useState(false);
  const [isNewOpen, setNewOpen] = useState(false);

  const { conversations, isLoading, error, refetch } = useConversations(user?.id, { archived: showArchived });

  const selected = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Messages"
        description="Private conversations with staff and families."
        action={
          <div className="w-full sm:w-auto sm:min-w-[10rem]">
            <Button type="button" onClick={() => setNewOpen(true)}>
              New message
            </Button>
          </div>
        }
      />

      <ErrorAlert message={error} />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 text-sm">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`focus-ring rounded-md px-3 py-1.5 font-medium ${!showArchived ? 'bg-surface-sunken text-content-primary' : 'text-content-tertiary'}`}
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`focus-ring rounded-md px-3 py-1.5 font-medium ${showArchived ? 'bg-surface-sunken text-content-primary' : 'text-content-tertiary'}`}
            >
              Archived
            </button>
          </div>

          {isLoading ? (
            <LoadingBlock label="Loading conversations…" />
          ) : conversations.length === 0 ? (
            <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
              {showArchived ? 'No archived conversations.' : 'No conversations yet.'}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/${c.id}`)}
                    className={`focus-ring flex w-full flex-col gap-0.5 rounded-card border px-3 py-2.5 text-left transition-colors ${
                      c.id === conversationId
                        ? 'border-brand-500/50 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-border bg-surface-raised hover:bg-surface-sunken'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-content-primary">{conversationTitle(c)}</span>
                      <span className="shrink-0 text-xs text-content-tertiary">{formatConversationTime(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm text-content-secondary">{c.lastMessagePreview ?? 'No messages yet'}</p>
                      {c.hasUnread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {conversationId ? (
            <ConversationView
              key={conversationId}
              conversationId={conversationId}
              onChanged={refetch}
              onArchived={() => {
                void refetch();
                navigate(basePath);
              }}
            />
          ) : (
            <div className="rounded-card border border-border bg-surface-raised px-4 py-16 text-center text-sm text-content-tertiary">
              {selected ? 'Opening…' : 'Select a conversation, or start a new one.'}
            </div>
          )}
        </div>
      </div>

      {isNewOpen && (
        <NewConversationModal
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            void refetch();
            navigate(`${basePath}/${id}`);
          }}
        />
      )}
    </PageContainer>
  );
}
