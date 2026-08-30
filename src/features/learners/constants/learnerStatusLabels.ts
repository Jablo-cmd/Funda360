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

/**
 * The admissions pipeline's four stages, in funnel order — a prospective
 * enquiry that has not yet applied, through to a fully enrolled learner
 * about to start attending. `active` (already attending) and the
 * lifecycle-exit statuses (suspended/transferred/graduated/withdrawn) are
 * deliberately excluded: those describe an existing learner's ongoing
 * standing, not a stage of getting admitted, and don't belong on this board.
 */
export const ADMISSIONS_PIPELINE_STAGES: LearnerStatus[] = ['prospective', 'applied', 'accepted', 'enrolled'];

/**
 * The single legal "advance" transition out of each pipeline stage, per the
 * `learners_validate_status_transition()` DB trigger's whitelist
 * (supabase/migrations/20260803190000_learner_management.sql) — that
 * whitelist is a strict forward-only chain with NO reverse transitions at
 * all (e.g. `applied → prospective` does not exist, only `prospective →
 * applied`), confirmed by a live rejected UPDATE during this feature's own
 * verification. The admissions board's one-click "advance" action reads
 * from this map rather than "the next column over" so it can never offer a
 * transition the database will reject; there is deliberately no
 * corresponding "move back" map for the same reason. `enrolled`'s legal
 * next step is `active` — off this board entirely (the applicant has
 * finished the pipeline and is now actually attending), not another
 * pipeline column, so advancing from Enrolled removes the card from the
 * board rather than moving it sideways.
 */
export const ADMISSIONS_NEXT_STATUS: Partial<Record<LearnerStatus, LearnerStatus>> = {
  prospective: 'applied',
  applied: 'accepted',
  accepted: 'enrolled',
  enrolled: 'active',
};
