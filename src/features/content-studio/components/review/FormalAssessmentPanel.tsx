import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { Modal } from '@/components/ui/Modal';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/toast/useToast';
import { useLoad } from '@/features/learning/hooks/useLoad';
import { curriculumErrorMessage } from '@/features/learning/utils/errors';
import { curriculumReviewService } from '@/features/content-studio/services/curriculumReviewService';
import { ReviewDecisionDialog, type DecisionTarget } from '@/features/content-studio/components/review/ReviewDecisionDialog';
import { Field, selectClass, textareaClass } from '@/features/content-studio/components/StudioBits';
import { citableSources, itemState, itemStateLabel, type ReviewCurrent } from '@/features/content-studio/utils/review';
import type { CurriculumFormalAssessmentDetailsRow, CurriculumSourceRow } from '@/lib/database.types';

type Row = CurriculumFormalAssessmentDetailsRow & { objective_code: string; objective_description: string };

function DetailsDialog({
  versionId,
  row,
  sources,
  onClose,
  onDone,
}: {
  versionId: string;
  row: Row | null;
  sources: CurriculumSourceRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [f, setF] = useState({
    name: '', type: '', scope: '', duration: '', timing: '', marks: '', weighting: '', instructions: '',
    sourceId: '', section: '', page: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!row) return null;
  const usable = citableSources(sources);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const missing = [
    f.name.trim().length < 3 && 'name',
    f.type.trim().length < 3 && 'type',
    f.scope.trim().length < 3 && 'scope',
    !f.sourceId && 'source',
    f.section.trim().length < 2 && 'section',
    f.page.trim().length < 1 && 'page or reference',
    f.notes.trim().length < 3 && 'reviewer notes',
  ].filter(Boolean) as string[];
  async function submit() {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      await curriculumReviewService.recordFormalDetails({
        versionId,
        objectiveId: row.objective_id,
        name: f.name,
        type: f.type,
        scope: f.scope,
        durationMinutes: f.duration ? Number(f.duration) : null,
        timing: f.timing,
        marks: f.marks ? Number(f.marks) : null,
        weighting: f.weighting,
        instructions: f.instructions,
        sourceId: f.sourceId,
        section: f.section,
        page: f.page,
        notes: f.notes,
      });
      showToast('Formal assessment details recorded.', { variant: 'success' });
      onDone();
      onClose();
    } catch (err) {
      setError(curriculumErrorMessage(err, 'That did not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Record official details"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={missing.length > 0} isLoading={busy} onClick={() => void submit()}>
            Record details
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-content-secondary">
          Copy only what the official source says. Leave marks and weighting empty unless the source
          states them. Nothing here is estimated or filled in for you.
        </p>
        <ErrorAlert message={error} />
        <TextField label="Assessment name" value={f.name} onChange={(e) => set('name')(e.target.value)} />
        <TextField label="Assessment type" value={f.type} onChange={(e) => set('type')(e.target.value)} />
        <Field label="Scope">
          <textarea className={textareaClass} value={f.scope} onChange={(e) => set('scope')(e.target.value)} />
        </Field>
        <TextField label="Duration in minutes (if the source states it)" type="number" min={1} value={f.duration} onChange={(e) => set('duration')(e.target.value)} />
        <TextField label="Timing (if the source states it)" value={f.timing} onChange={(e) => set('timing')(e.target.value)} />
        <TextField label="Marks (only if verified in the source)" type="number" min={1} value={f.marks} onChange={(e) => set('marks')(e.target.value)} />
        <TextField label="Weighting (only if verified in the source)" value={f.weighting} onChange={(e) => set('weighting')(e.target.value)} />
        <Field label="Instructions (if the source states them)">
          <textarea className={textareaClass} value={f.instructions} onChange={(e) => set('instructions')(e.target.value)} />
        </Field>
        {usable.length === 0 ? (
          <p role="alert" className="text-sm text-danger-600">
            No source has its identity verified yet, so official details cannot be recorded.
          </p>
        ) : (
          <Field label="Source">
            <select className={selectClass} value={f.sourceId} onChange={(e) => set('sourceId')(e.target.value)}>
              <option value="">Choose a source…</option>
              {usable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <TextField label="Section of the source" value={f.section} onChange={(e) => set('section')(e.target.value)} />
        <TextField label="Page or reference" value={f.page} onChange={(e) => set('page')(e.target.value)} />
        <Field label="Reviewer notes (required)">
          <textarea className={textareaClass} value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
        {missing.length > 0 && (
          <p className="text-xs text-content-tertiary">Still needed: {missing.join(', ')}.</p>
        )}
      </div>
    </Modal>
  );
}

/** FA.01: shows exactly what is known, lets a specialist record verified details, and records the review decision. */
export function FormalAssessmentPanel({
  versionId,
  sources,
  locked,
  onChanged,
  refreshKey,
}: {
  versionId: string;
  sources: CurriculumSourceRow[];
  locked: boolean;
  onChanged: () => void;
  refreshKey: number;
}) {
  const [rev, setRev] = useState(0);
  const list = useLoad(
    async () => {
      const [rows, items] = await Promise.all([
        curriculumReviewService.listFormalAssessments(versionId),
        curriculumReviewService.items<{ id: string; review: ReviewCurrent | null }>(versionId, 'objective'),
      ]);
      return { rows, current: new Map(items.map((i) => [i.id, i.review])) };
    },
    `${versionId}:fa:${rev}:${refreshKey}`,
  );
  const [editing, setEditing] = useState<Row | null>(null);
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const done = () => {
    setRev((n) => n + 1);
    onChanged();
  };
  return (
    <Card title="Formal assessment">
      <p className="text-sm text-content-secondary">
        Funda360 holds no marks, weighting, rubric or question count for the formal assessment, and
        none is invented. Only what a person copies from the official source is recorded here. The
        Funda360 revision check is practice, not the formal assignment.
      </p>
      <ErrorAlert message={list.error} />
      {list.isLoading && !list.data ? (
        <LoadingBlock label="Loading formal assessment…" />
      ) : (
        (list.data?.rows ?? []).map((row) => {
          const decision = list.data?.current.get(row.objective_id) ?? null;
          return (
            <div key={row.id} className="flex flex-col gap-3 rounded-card border border-border p-3">
              <h3 className="break-words text-sm font-semibold text-content-primary">
                {row.objective_code}: {row.objective_description}
              </h3>
              <p className="text-xs text-content-tertiary">
                Details: {row.status === 'recorded' ? 'recorded from a source' : 'not recorded: pending'} · Review: {itemStateLabel(itemState(decision))}
              </p>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ['Name', row.assessment_name],
                  ['Type', row.assessment_type],
                  ['Scope', row.scope],
                  ['Duration', row.duration_minutes ? `${row.duration_minutes} minutes` : null],
                  ['Timing', row.timing],
                  ['Marks', row.marks ? String(row.marks) : null],
                  ['Weighting', row.weighting],
                  ['Instructions', row.instructions],
                  ['Source', row.source_section ? `${sources.find((s) => s.id === row.source_id)?.title ?? 'Unknown'}, section ${row.source_section}, page ${row.source_page}` : null],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-content-tertiary">{label}</dt>
                    <dd className="break-words text-sm text-content-primary">{value ?? 'Not recorded'}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="secondary" disabled={locked} onClick={() => setEditing(row)} aria-label="Record official details of the formal assessment">
                  Record official details
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={locked}
                  onClick={() =>
                    setTarget({ entity: 'formal_assessment', id: row.objective_id, label: `${row.objective_code}: formal assessment`, current: decision })
                  }
                  aria-label="Review the formal assessment"
                >
                  Review
                </Button>
              </div>
            </div>
          );
        })
      )}
      <DetailsDialog versionId={versionId} row={editing} sources={sources} onClose={() => setEditing(null)} onDone={done} />
      <ReviewDecisionDialog versionId={versionId} target={target} sources={sources} onClose={() => setTarget(null)} onDone={done} />
    </Card>
  );
}
