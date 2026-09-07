import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { homeworkService } from '@/features/homework/services/homeworkService';
import type { Assignment, AssignmentSubmission } from '@/features/homework/types/homework.types';
import { SUBMISSION_STATUS_LABELS, formatDue, isMissing } from '@/features/homework/utils/homeworkDisplay';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface ChildHomeworkTabProps {
  learnerId: string;
}

/**
 * Reads through the same RLS the family Homework page uses
 * (assignment_submissions scoped by is_learner_guardian, non-draft
 * assignments only). Read-only here — submitting happens on the dedicated
 * /parent/homework/:id page this links to.
 */
export function ChildHomeworkTab({ learnerId }: ChildHomeworkTabProps) {
  const [items, setItems] = useState<Array<{ assignment: Assignment; submission: AssignmentSubmission }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    homeworkService
      .listAssignmentsForLearners([learnerId])
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((err) => {
        if (!cancelled) setError(getDbErrorMessage(err, 'Failed to load homework.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  if (isLoading) return <LoadingBlock label="Loading homework…" />;

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert message={error} />
      {items.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No homework has been set yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(({ assignment, submission }) => (
            <li key={submission.id}>
              <Link
                to={`/parent/homework/${assignment.id}`}
                className="focus-ring flex flex-col gap-1 rounded-card border border-border bg-surface-raised px-4 py-3 hover:bg-surface-sunken"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-content-primary">{assignment.title}</span>
                  <span className="text-xs text-content-tertiary">
                    {isMissing(submission, assignment.dueAt) ? 'Missing' : SUBMISSION_STATUS_LABELS[submission.status]}
                  </span>
                </div>
                <span className="text-sm text-content-secondary">
                  {assignment.subjectName} · {formatDue(assignment.dueAt)}
                  {submission.pointsAwarded != null &&
                    ` · ${submission.pointsAwarded}${assignment.maxPoints ? `/${assignment.maxPoints}` : ''}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
