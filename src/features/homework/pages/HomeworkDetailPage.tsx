import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { useToast } from '@/components/ui/toast/useToast';
import { homeworkService } from '@/features/homework/services/homeworkService';
import { useAssignmentDetail } from '@/features/homework/hooks/useAssignmentDetail';
import {
  SUBMISSION_STATUS_LABELS,
  formatDue,
  isMissing,
  summariseSubmissions,
} from '@/features/homework/utils/homeworkDisplay';
import type { AssignmentSubmission } from '@/features/homework/types/homework.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function HomeworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { assignment, submissions, isLoading, error, refetch } = useAssignmentDetail(id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [marking, setMarking] = useState<AssignmentSubmission | null>(null);
  const [points, setPoints] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const summary = useMemo(
    () => summariseSubmissions(submissions, assignment?.dueAt ?? null),
    [submissions, assignment?.dueAt],
  );

  if (isLoading) return <PageContainer><LoadingBlock label="Loading assignment…" /></PageContainer>;
  if (error || !assignment) return <PageContainer><ErrorAlert message={error ?? 'Not found.'} /></PageContainer>;

  const runAction = async (fn: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await refetch();
      showToast(successMessage, { variant: 'success' });
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const openMark = (submission: AssignmentSubmission) => {
    setMarking(submission);
    setPoints(submission.pointsAwarded != null ? String(submission.pointsAwarded) : '');
    setFeedback(submission.teacherFeedback ?? '');
  };

  const saveMark = async (finalise: boolean) => {
    if (!marking) return;
    await runAction(
      () =>
        homeworkService.markSubmission(marking.id, {
          points: points ? Number(points) : null,
          feedback: feedback.trim() || null,
          finalise,
        }),
      finalise ? 'Submission marked.' : 'Feedback returned to the learner.',
    );
    setMarking(null);
  };

  return (
    <PageContainer>
      <button type="button" onClick={() => navigate('/homework')} className="mb-2 text-sm text-content-tertiary underline">
        ← All homework
      </button>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-content-primary">{assignment.title}</h1>
          <div className="flex gap-2">
            {assignment.status === 'draft' && (
              <Button
                type="button"
                onClick={() => void runAction(() => homeworkService.publishAssignment(assignment.id), 'Assignment published.')}
                isLoading={busy}
              >
                Publish
              </Button>
            )}
            {assignment.status === 'published' && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void runAction(() => homeworkService.closeAssignment(assignment.id), 'Assignment closed.')}
                isLoading={busy}
              >
                Close
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-content-secondary">
          {assignment.className} · {assignment.subjectName} · {formatDue(assignment.dueAt)} ·{' '}
          <span className="capitalize">{assignment.status}</span>
        </p>
        {assignment.instructions && (
          <p className="mt-2 whitespace-pre-wrap rounded-card border border-border bg-surface-raised p-3 text-sm text-content-secondary">
            {assignment.instructions}
          </p>
        )}
      </div>

      <ErrorAlert message={actionError} />

      {assignment.status === 'draft' ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-8 text-center text-sm text-content-tertiary">
          Publish this assignment to send it to the class and start collecting submissions.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span><strong>{summary.total}</strong> learners</span>
            <span><strong>{summary.submitted}</strong> submitted</span>
            <span className="text-amber-600 dark:text-amber-400"><strong>{summary.awaiting}</strong> to mark</span>
            <span className="text-danger-600"><strong>{summary.missing}</strong> missing</span>
            <span className="text-success-600"><strong>{summary.marked}</strong> done</span>
          </div>

          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left text-content-secondary">
                <tr>
                  <th className="px-3 py-2">Learner</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Submitted</th>
                  <th className="px-3 py-2">Mark</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-content-primary">{s.learnerName ?? s.learnerId}</td>
                    <td className="px-3 py-2">
                      {isMissing(s, assignment.dueAt) ? (
                        <span className="text-danger-600">Missing</span>
                      ) : (
                        SUBMISSION_STATUS_LABELS[s.status]
                      )}
                    </td>
                    <td className="px-3 py-2 text-content-tertiary">
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {s.pointsAwarded != null ? `${s.pointsAwarded}${assignment.maxPoints ? ` / ${assignment.maxPoints}` : ''}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(s.status === 'submitted' || s.status === 'late' || s.status === 'returned' || s.status === 'reviewed') && (
                        <button type="button" className="text-brand-600 underline" onClick={() => openMark(s)}>
                          {s.status === 'reviewed' ? 'Edit mark' : 'Mark'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {marking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card border border-border bg-surface-raised p-4">
            <h2 className="text-lg font-semibold text-content-primary">Mark: {marking.learnerName}</h2>
            {marking.submissionText && (
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-sunken p-2 text-sm text-content-secondary">
                {marking.submissionText}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-3">
              <label className="text-sm font-medium text-content-primary">
                Points {assignment.maxPoints ? `(out of ${assignment.maxPoints})` : ''}
                <input
                  type="number"
                  min={0}
                  className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-content-primary">
                Feedback
                <textarea
                  className="mt-1 min-h-[4rem] w-full rounded-md border border-border-strong bg-surface-raised p-2 text-sm"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveMark(true)} isLoading={busy}>
                  Mark as done
                </Button>
                {assignment.allowResubmission && (
                  <Button type="button" variant="secondary" onClick={() => void saveMark(false)} isLoading={busy}>
                    Return for redo
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setMarking(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
