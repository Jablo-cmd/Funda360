import { useEffect, useState } from 'react';
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
import { Field, selectClass, textareaClass } from '@/features/content-studio/components/StudioBits';
import { citableSources, questionProblems } from '@/features/content-studio/utils/review';
import type { CurriculumOpenQuestionRow, CurriculumSourceRow } from '@/lib/database.types';

const STATUS_LABEL = { open: 'Open', resolved: 'Resolved', deferred: 'Deferred: requires further curriculum review' } as const;

function AnswerDialog({
  question,
  sources,
  onClose,
  onDone,
}: {
  question: CurriculumOpenQuestionRow | null;
  sources: CurriculumSourceRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<'open' | 'resolved' | 'deferred'>('resolved');
  const [answer, setAnswer] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [section, setSection] = useState('');
  const [page, setPage] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setStatus(question?.status === 'resolved' ? 'resolved' : 'deferred');
    setAnswer('');
    setSourceId('');
    setSection('');
    setPage('');
    setNotes('');
    setError(null);
  }, [question?.id, question?.status]);
  if (!question) return null;
  const usable = citableSources(sources);
  const problems = questionProblems({ status, answer, sourceId, section, page, notes });
  async function submit() {
    if (!question) return;
    setBusy(true);
    setError(null);
    try {
      await curriculumReviewService.resolveQuestion({ id: question.id, status, answer, sourceId, section, page, notes });
      showToast(`${question.code} marked ${status}.`, { variant: 'success' });
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
      title={`${question.code}: ${question.title}`}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={problems.length > 0} isLoading={busy} onClick={() => void submit()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="break-words text-sm text-content-secondary">{question.description}</p>
        <ErrorAlert message={error} />
        <Field label="Status">
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="resolved">Resolved, with evidence</option>
            <option value="deferred">Deferred: requires further curriculum review</option>
            <option value="open">Reopen</option>
          </select>
        </Field>
        {status === 'resolved' && (
          <div className="flex flex-col gap-3 rounded-card border border-border p-3">
            <p className="text-xs text-content-secondary">
              A question is only resolved when the answer is backed by a source whose identity has
              been verified. If you cannot establish the answer, defer it instead.
            </p>
            <Field label="Answer">
              <textarea className={textareaClass} value={answer} onChange={(e) => setAnswer(e.target.value)} />
            </Field>
            {usable.length === 0 ? (
              <p role="alert" className="text-sm text-danger-600">
                No source has its identity verified yet. Defer this question until one has.
              </p>
            ) : (
              <Field label="Source of the answer">
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
        <Field label={status === 'deferred' ? 'Why is it deferred? (required)' : 'Explanation (required)'}>
          <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {problems.length > 0 && (
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

/** The nine open curriculum questions as review tasks. Resolving one needs an answer, a verified source and an explanation. */
export function OpenQuestionsPanel({
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
  const list = useLoad(() => curriculumReviewService.listOpenQuestions(versionId), `${versionId}:q:${rev}:${refreshKey}`);
  const [target, setTarget] = useState<CurriculumOpenQuestionRow | null>(null);
  const sourceTitle = (id: string | null) => sources.find((s) => s.id === id)?.title ?? null;
  return (
    <Card title="Open questions">
      <p className="text-sm text-content-secondary">
        These were not settled by the evidence available when the pack was written. “Deferred” is a
        valid answer when you cannot establish one, but a deferred question that affects scope still
        stops the curriculum from being verified.
      </p>
      <ErrorAlert message={list.error} />
      {list.isLoading && !list.data ? (
        <LoadingBlock label="Loading questions…" />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Open questions">
          {(list.data ?? []).map((q) => (
            <li key={q.id} className="flex min-w-0 flex-col gap-2 rounded-card border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 break-words text-sm font-semibold text-content-primary">
                  {q.code}. {q.title}
                </h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-content-secondary">
                  {STATUS_LABEL[q.status]}
                </span>
              </div>
              <p className="break-words text-sm text-content-secondary">{q.description}</p>
              <p className="text-xs text-content-tertiary">
                {q.materially_affects_scope ? 'Affects scope: must be resolved before verification.' : 'Does not affect scope.'}
              </p>
              {q.status === 'resolved' && (
                <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-content-tertiary">Answer</dt><dd className="break-words">{q.answer}</dd></div>
                  <div>
                    <dt className="text-xs text-content-tertiary">Source</dt>
                    <dd className="break-words">{sourceTitle(q.source_id) ?? 'Unknown'}, section {q.source_section}, page {q.source_page}</dd>
                  </div>
                </dl>
              )}
              {q.status !== 'open' && q.notes && (
                <p className="break-words text-xs text-content-tertiary">
                  Notes: {q.notes}
                  {q.resolved_at ? ` (${new Date(q.resolved_at).toLocaleDateString('en-ZA')})` : ''}
                </p>
              )}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={locked}
                  onClick={() => setTarget(q)}
                  aria-label={`${q.status === 'open' ? 'Answer or defer' : 'Change'} question ${q.code}`}
                >
                  {q.status === 'open' ? 'Answer or defer' : 'Change'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnswerDialog
        question={target}
        sources={sources}
        onClose={() => setTarget(null)}
        onDone={() => {
          setRev((n) => n + 1);
          onChanged();
        }}
      />
    </Card>
  );
}
