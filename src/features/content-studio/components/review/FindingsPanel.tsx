import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/toast/useToast';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumErrorMessage } from '@/features/learning/utils/errors';
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';
import { Field, selectClass, textareaClass } from '@/features/content-studio/components/StudioBits';
import { ENTITY_LABEL, FINDING_LABEL } from '@/features/content-studio/utils/review';
import type { CurriculumReviewFindingRow } from '@/lib/database.types';

/** Findings raised by reviewers. An open finding blocks completion until someone says how it was dealt with. */
export function FindingsPanel({
  versionId,
  locked,
  onChanged,
  refreshKey,
}: {
  versionId: string;
  locked: boolean;
  onChanged: () => void;
  refreshKey: number;
}) {
  const { showToast } = useToast();
  const [rev, setRev] = useState(0);
  const list = useLoad(() => curriculumReviewService.listFindings(versionId), `${versionId}:f:${rev}:${refreshKey}`);
  const [target, setTarget] = useState<CurriculumReviewFindingRow | null>(null);
  const [status, setStatus] = useState<'resolved' | 'dismissed'>('resolved');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await curriculumReviewService.resolveFinding(target.id, status, note);
      showToast('Finding closed.', { variant: 'success' });
      setTarget(null);
      setNote('');
      setRev((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(curriculumErrorMessage(err, 'That did not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Findings">
      <p className="text-sm text-content-secondary">
        Findings are raised by reviewers instead of editing content. Closing one records who closed
        it, when, and how.
      </p>
      <ErrorAlert message={list.error} />
      {list.isLoading && !list.data ? (
        <LoadingBlock label="Loading findings…" />
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-content-secondary">No findings have been raised.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Findings">
          {(list.data ?? []).map((f) => (
            <li key={f.id} className="flex min-w-0 flex-col gap-2 rounded-card border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-content-primary">
                  {FINDING_LABEL[f.category]} · {f.entity_type in ENTITY_LABEL ? ENTITY_LABEL[f.entity_type as keyof typeof ENTITY_LABEL] : f.entity_type}
                </h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-content-secondary">
                  {f.status === 'open' ? 'Open' : f.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                </span>
              </div>
              <p className="break-words text-sm text-content-secondary">{f.description}</p>
              {f.status !== 'open' && (
                <p className="break-words text-xs text-content-tertiary">
                  {f.resolution_note} ({f.resolved_at ? new Date(f.resolved_at).toLocaleDateString('en-ZA') : ''})
                </p>
              )}
              {f.status === 'open' && (
                <div>
                  <Button type="button" variant="secondary" disabled={locked} onClick={() => setTarget(f)} aria-label={`Close finding: ${f.description.slice(0, 40)}`}>
                    Close finding
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {target && (
        <Modal
          isOpen
          onClose={() => setTarget(null)}
          title="Close finding"
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button type="button" disabled={note.trim().length < 3} isLoading={busy} onClick={() => void submit()}>
                Close finding
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="break-words text-sm text-content-secondary">{target.description}</p>
            <ErrorAlert message={error} />
            <Field label="Outcome">
              <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed (not a problem)</option>
              </select>
            </Field>
            <Field label="How was it dealt with? (required)">
              <textarea className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}
