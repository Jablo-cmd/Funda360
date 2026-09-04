import type { LearnerStatus } from '@/features/learners/types/learner.types';

/**
 * Single source of truth for how each learner_status enum value is labeled
 * in the UI — was previously duplicated between LearnersFiltersBar and
 * ChangeLearnerStatusDialog (each kept its own STATUS_OPTIONS array with
 * the same nine entries); extracted here so a future status rename can't
 * drift between the two, the same reasoning as DOCUMENT_TYPE_LABELS.
 */
export const LEARNER_STATUS_LABELS: Record<LearnerStatus, string> = {
  prospective: 'Prospective',
  applied: 'Applied',
  accepted: 'Accepted',
  enrolled: 'Enrolled',
  active: 'Active',
  suspended: 'Suspended',
  transferred: 'Transferred',
  graduated: 'Graduated',
  withdrawn: 'Withdrawn',
};

export const LEARNER_STATUS_OPTIONS: { value: LearnerStatus; label: string }[] = (
  Object.entries(LEARNER_STATUS_LABELS) as [LearnerStatus, string][]
).map(([value, label]) => ({ value, label }));
