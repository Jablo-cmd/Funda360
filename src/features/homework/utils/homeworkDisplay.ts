import type { AssignmentSubmissionStatus } from '@/lib/database.types';
import type { AssignmentSubmission } from '@/features/homework/types/homework.types';

export const SUBMISSION_STATUS_LABELS: Record<AssignmentSubmissionStatus, string> = {
  assigned: 'Not submitted',
  submitted: 'Submitted',
  late: 'Submitted late',
  returned: 'Returned',
  reviewed: 'Reviewed',
  excused: 'Excused',
};

/**
 * A submission is "missing" when it was assigned, is still unsubmitted, and
 * the due date has passed. Pure — unit-tested.
 */
export function isMissing(
  submission: Pick<AssignmentSubmission, 'status'>,
  dueAt: string | null,
  now: Date = new Date(),
): boolean {
  if (submission.status !== 'assigned') return false;
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** Roll-up counts for a teacher's assignment overview. */
export function summariseSubmissions(
  submissions: Array<Pick<AssignmentSubmission, 'status'>>,
  dueAt: string | null,
  now: Date = new Date(),
): { total: number; submitted: number; awaiting: number; missing: number; marked: number } {
  let submitted = 0;
  let awaiting = 0;
  let missing = 0;
  let marked = 0;
  for (const s of submissions) {
    if (s.status === 'submitted' || s.status === 'late' || s.status === 'returned') {
      submitted += 1;
      if (s.status !== 'returned') awaiting += 1;
    } else if (s.status === 'reviewed' || s.status === 'excused') {
      marked += 1;
    } else if (isMissing(s, dueAt, now)) {
      missing += 1;
    }
  }
  return { total: submissions.length, submitted, awaiting, missing, marked };
}

export function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return `Due ${new Date(dueAt).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}
