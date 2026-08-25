import { useSchool } from '@/features/school/hooks/useSchool';
import { useChildContext } from '@/features/parentPortal/hooks/useChildContext';
import { LearnerSelfSummary } from '@/features/learners/components/LearnerSelfSummary';
import type { Learner } from '@/features/learners/types/learner.types';

export interface ChildOverviewTabProps {
  learner: Learner;
}

/**
 * Grade/class/teacher context, plus LearnerSelfSummary reused as-is —
 * that component already shows identity, medical information, and
 * emergency contacts, scoped entirely by RLS (learner_medical_information_select
 * and learner_emergency_contacts_select's guardian clauses), with no
 * manage actions. Nothing new needed for the medical/emergency portion.
 */
export function ChildOverviewTab({ learner }: ChildOverviewTabProps) {
  const { school } = useSchool();
  const { gradeName, className, classTeacherName, isLoading } = useChildContext(learner.id, school?.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
        <h3 className="mb-4 text-sm font-semibold text-content-primary">Class</h3>
        {isLoading ? (
          <p className="text-sm text-content-tertiary">Loading…</p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Grade</dt>
              <dd className="mt-1 text-sm text-content-primary">{gradeName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Class</dt>
              <dd className="mt-1 text-sm text-content-primary">{className ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Class teacher</dt>
              <dd className="mt-1 text-sm text-content-primary">{classTeacherName ?? '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      <LearnerSelfSummary learner={learner} />
    </div>
  );
}
