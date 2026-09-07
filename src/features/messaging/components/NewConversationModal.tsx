import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useAuth } from '@/features/auth/context/authContext';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { MessageableProfile } from '@/features/messaging/types/messaging.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface NewConversationModalProps {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationModal({ onClose, onCreated }: NewConversationModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessageableProfile[]>([]);
  const [selected, setSelected] = useState<MessageableProfile[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      messagingService
        .searchMessageableProfiles(query, user.id)
        .then((next) => {
          if (!cancelled) setResults(next);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, user?.id]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const kind = selected.length > 1 ? 'group' : 'direct';

  const handleSubmit = async () => {
    if (selected.length === 0 || body.trim().length === 0) {
      setError('Choose at least one recipient and write a message.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await messagingService.startConversation({
        participantProfileIds: selected.map((s) => s.id),
        body: body.trim(),
        subject: subject.trim() || null,
        kind,
      });
      onCreated(id);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Could not start this conversation.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New message"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} isLoading={busy}>
            Send
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ErrorAlert message={error} />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelected((prev) => prev.filter((p) => p.id !== s.id))}
                className="focus-ring rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
              >
                {s.firstName} {s.lastName} ✕
              </button>
            ))}
          </div>
        )}

        <TextField
          label="Recipients"
          placeholder="Search by name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.filter((r) => !selectedIds.has(r.id)).length > 0 && (
          <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
            {results
              .filter((r) => !selectedIds.has(r.id))
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((prev) => [...prev, r]);
                      setQuery('');
                    }}
                    className="focus-ring flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-sunken"
                  >
                    <span className="font-medium text-content-primary">
                      {r.firstName} {r.lastName}
                    </span>
                    <span className="text-xs text-content-tertiary">{r.email}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        {selected.length > 1 && (
          <TextField
            label="Subject (optional)"
            placeholder="What is this about?"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-content-primary">
          Message
          <textarea
            className="min-h-[6rem] w-full rounded-md border border-border-strong bg-surface-raised p-2 text-sm text-content-primary"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
