import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useMyLearners } from '@/features/learners/hooks/useMyLearners';
import { homeworkService } from '@/features/homework/services/homeworkService';
import type { Assignment, AssignmentSubmission } from '@/features/homework/types/homework.types';
import { SUBMISSION_STATUS_LABELS, formatDue, isMissing } from '@/features/homework/utils/homeworkDisplay';
import { getDbErrorMessage } from '@/lib/dbErrors';

interface Item {
  assignment: Assignment;
  submission: AssignmentSubmission;
}

export function ParentHomeworkPage() {
  const { data: learners, isLoading: learnersLoading } = useMyLearners();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const learnerNameById = useMemo(
    () => new Map(learners.map((l) => [l.id, `${l.firstName} ${l.lastName}`.trim()])),
    [learners],
  );

  const load = useMemo(
    () => async () => {
      if (learnersLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        setItems(await homeworkService.listAssignmentsForLearners(learners.map((l) => l.id)));
      } catch (err) {
        setError(getDbErrorMessage(err, 'Failed to load homework.'));
      } finally {
        setIsLoading(false);
      }
    },
    [learners, learnersLoading],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((i) => i.assignment.id === assignmentId) ?? null;

  useEffect(() => {
    setDraft(selected?.submission.submissionText ?? '');
  }, [selected]);

  const handleSubmit = async () => {
    if (!selected || draft.trim().length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await homeworkService.submitAssignment(selected.assignment.id, selected.submission.learnerId, draft.trim());
      await load();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Could not submit.'));
    } finally {
      setBusy(false);
    }
  };

  if (learnersLoading || isLoading) return <PageContainer><LoadingBlock label="Loading homework…" /></PageContainer>;

  const canSubmit =
    selected &&
    selected.assignment.status === 'published' &&
    (selected.submission.status === 'assigned' ||
      selected.submission.status === 'returned' ||
      ((selected.submission.status === 'submitted' || selected.submission.status === 'late') &&
        selected.assignment.allowResubmission));

  return (
    <PageContainer>
      <PageHeader title="Homework" description="Assignments set for your children." />
      <ErrorAlert message={error} />

      {selected ? (
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => navigate('/parent/homework')} className="text-sm text-content-tertiary underline">
            ← All homework
          </button>
          <h2 className="text-xl font-bold text-content-primary">{selected.assignment.title}</h2>
          <p className="text-sm text-content-secondary">
            {learnerNameById.get(selected.submission.learnerId)} · {selected.assignment.subjectName} ·{' '}
            {formatDue(selected.assignment.dueAt)}
          </p>
          {selected.assignment.instructions && (
            <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-raised p-3 text-sm text-content-secondary">
              {selected.assignment.instructions}
            </p>
          )}

          <div className="rounded-card border border-border bg-surface-raised p-3 text-sm">
            <p className="font-medium text-content-primary">
              Status:{' '}
              {isMissing(selected.submission, selected.assignment.dueAt)
                ? 'Missing'
                : SUBMISSION_STATUS_LABELS[selected.submission.status]}
            </p>
            {selected.submission.pointsAwarded != null && (
              <p className="text-content-secondary">
                Mark: {selected.submission.pointsAwarded}
                {selected.assignment.maxPoints ? ` / ${selected.assignment.maxPoints}` : ''}
              </p>
            )}
            {selected.submission.teacherFeedback && (
              <p className="mt-1 text-content-secondary">Feedback: {selected.submission.teacherFeedback}</p>
            )}
          </div>

          <ErrorAlert message={actionError} />
          {canSubmit ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-content-primary">
                Your submission
                <textarea
                  className="mt-1 min-h-[6rem] w-full rounded-md border border-border-strong bg-surface-raised p-2 text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <div className="w-40">
                <Button type="button" onClick={() => void handleSubmit()} isLoading={busy} disabled={draft.trim().length === 0}>
                  {selected.submission.status === 'assigned' ? 'Submit' : 'Resubmit'}
                </Button>
              </div>
            </div>
          ) : (
            selected.submission.submissionText && (
              <p className="whitespace-pre-wrap rounded-card border border-border bg-surface-sunken p-3 text-sm text-content-secondary">
                {selected.submission.submissionText}
              </p>
            )
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No homework has been set yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.submission.id}>
              <button
                type="button"
                onClick={() => navigate(`/parent/homework/${item.assignment.id}`)}
                className="focus-ring flex w-full flex-col gap-1 rounded-card border border-border bg-surface-raised px-4 py-3 text-left hover:bg-surface-sunken"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-content-primary">{item.assignment.title}</span>
                  <span className="text-xs text-content-tertiary">
                    {isMissing(item.submission, item.assignment.dueAt)
                      ? 'Missing'
                      : SUBMISSION_STATUS_LABELS[item.submission.status]}
                  </span>
                </div>
                <span className="text-sm text-content-secondary">
                  {learnerNameById.get(item.submission.learnerId)} · {item.assignment.subjectName} ·{' '}
                  {formatDue(item.assignment.dueAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
