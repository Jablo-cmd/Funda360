import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/toast/useToast';
import { curriculumErrorMessage } from '@/features/learning/utils/errors';
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';
import { Field, selectClass, textareaClass } from '@/features/content-studio/components/StudioBits';
import {
  DECISION_LABEL,
  ENTITY_LABEL,
  FINDING_LABEL,
  POSITIVE_DECISION,
  citableSources,
  decisionProblems,
  itemStateLabel,
  itemState,
  type ReviewCurrent,
} from '@/features/content-studio/utils/review';
import type {
  CurriculumSourceRow,
  FindingCategory,
  ReviewDecisionValue,
  ReviewEntityType,
} from '@/lib/database.types';

export interface DecisionTarget {
  entity: ReviewEntityType;
  id: string;
  label: string;
  current: ReviewCurrent | null;
}

const ACTION_LABEL: Record<ReviewDecisionValue, string> = {
  verified: 'Verify',
  accepted: 'Accept',
  needs_correction: 'Request correction',
  rejected: 'Reject',
};

/**
 * One reviewer decision. A positive decision on an objective needs a real source; a negative decision needs notes and
 * becomes a finding. Nothing here edits the unit under review.
 */
export function ReviewDecisionDialog({
  versionId,
  target,
  sources,
  onClose,
  onDone,
}: {
  versionId: string;
  target: DecisionTarget | null;
  sources: CurriculumSourceRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [decision, setDecision] = useState<ReviewDecisionValue | null>(null);
  const [notes, setNotes] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [section, setSection] = useState('');
  const [page, setPage] = useState('');
  const [category, setCategory] = useState<FindingCategory>('other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDecision(null);
    setNotes('');
    setSourceId('');
    setSection('');
    setPage('');
    setCategory('other');
    setError(null);
  }, [target?.id, target?.entity]);

  if (!target) return null;
  const positive = POSITIVE_DECISION[target.entity];
  const options: ReviewDecisionValue[] = [positive, 'needs_correction', 'rejected'];
  const needsSource =
    decision === positive && (target.entity === 'objective' || target.entity === 'formal_assessment');
  const usable = citableSources(sources);
  const problems = decision
    ? decisionProblems({ entity: target.entity, decision, notes, sourceId, section, page })
    : ['Choose a decision.'];

  async function submit() {
    if (!target || !decision) return;
    setBusy(true);
    setError(null);
    try {
      await curriculumReviewService.recordDecision({
        versionId,
        entity: target.entity,
        entityId: target.id,
        decision,
        notes,
        ...(needsSource ? { sourceId, section, page } : {}),
        ...(decision === 'needs_correction' || decision === 'rejected' ? { category } : {}),
      });
      showToast(`${DECISION_LABEL[decision]} recorded.`, { variant: 'success' });
      onDone();
      onClose();
    } catch (err) {
      setError(curriculumErrorMessage(err, 'That decision did not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Review ${ENTITY_LABEL[target.entity]}`}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={problems.length > 0}
            isLoading={busy}
            onClick={() => void submit()}
          >
            {decision ? ACTION_LABEL[decision] : 'Record decision'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="break-words text-sm font-medium text-content-primary">{target.label}</p>
        <p className="text-xs text-content-tertiary">
          Current: {itemStateLabel(itemState(target.current))}
          {target.current ? ` (by ${target.current.reviewer.slice(0, 8)}…)` : ''}. The{' '}
          {ENTITY_LABEL[target.entity]} is not edited by this review; a negative decision creates a
          finding for the author.
        </p>
        <ErrorAlert message={error} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-content-primary">Decision</legend>
          {options.map((o) => (
            <label key={o} className="flex min-h-11 items-center gap-2 text-sm text-content-primary">
              <input
                type="radio"
                name="decision"
                className="h-5 w-5"
                checked={decision === o}
                onChange={() => setDecision(o)}
              />
              {ACTION_LABEL[o]}
            </label>
          ))}
        </fieldset>
        {needsSource && (
          <div className="flex flex-col gap-3 rounded-card border border-border p-3">
            <p className="text-xs text-content-secondary">
              To verify, say exactly where in the source this was checked. A source can only be
              cited once its identity has been verified.
            </p>
            {usable.length === 0 ? (
              <p role="alert" className="text-sm text-danger-600">
                No source has its identity verified yet, so nothing can be verified against it.
                Complete the source steps, or choose “Request correction” or “Reject”.
              </p>
            ) : (
              <Field label="Source checked">
                <select className={selectClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="">Choose a source…</option>
                  {usable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <TextField label="Section of the source" value={section} onChange={(e) => setSection(e.target.value)} />
            <TextField label="Page or reference" value={page} onChange={(e) => setPage(e.target.value)} />
          </div>
        )}
        {(decision === 'needs_correction' || decision === 'rejected') && (
          <Field label="What kind of problem is it?">
            <select
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value as FindingCategory)}
            >
              {(Object.keys(FINDING_LABEL) as FindingCategory[]).map((c) => (
                <option key={c} value={c}>
                  {FINDING_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Reviewer notes (required)">
          <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {decision && problems.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-content-tertiary" aria-label="Still needed">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Flag a problem without making a decision and without editing anything. */
export function FlagDialog({
  versionId,
  target,
  onClose,
  onDone,
}: {
  versionId: string;
  target: { entity: ReviewEntityType; id: string; label: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<FindingCategory>('factual_error');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDescription('');
    setError(null);
  }, [target?.id]);
  if (!target) return null;
  async function submit() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await curriculumReviewService.raiseFinding({
        versionId,
        entity: target.entity,
        entityId: target.id,
        category,
        description,
      });
      showToast('Finding recorded.', { variant: 'success' });
      onDone();
      onClose();
    } catch (err) {
      setError(curriculumErrorMessage(err, 'The finding did not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Flag an issue"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={description.trim().length < 3} isLoading={busy} onClick={() => void submit()}>
            Record finding
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="break-words text-sm font-medium text-content-primary">{target.label}</p>
        <p className="text-xs text-content-tertiary">
          This records a finding for the author. It does not change the content and does not decide
          the review.
        </p>
        <ErrorAlert message={error} />
        <Field label="Kind of problem">
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as FindingCategory)}>
            {(Object.keys(FINDING_LABEL) as FindingCategory[]).map((c) => (
              <option key={c} value={c}>
                {FINDING_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="What is wrong?">
          <textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
