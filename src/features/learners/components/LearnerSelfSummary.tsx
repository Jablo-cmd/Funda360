import { useMedicalInformation } from '@/features/learners/hooks/useMedicalInformation';
import type { Learner } from '@/features/learners/types/learner.types';

export interface LearnerSelfSummaryProps {
  learner: Learner;
}

/**
 * Read-only self/guardian-view summary of a single linked learner — no
 * manage actions, unlike LearnerProfilePage. Also shows this learner's
 * medical information when a record exists; RLS (learner_medical_information_select's
 * guardian/self clauses) is what confines this to the caller's own linked
 * learner(s), not any check in this component.
 */
export function LearnerSelfSummary({ learner }: LearnerSelfSummaryProps) {
  const { medicalInformation, error: medicalError } = useMedicalInformation(learner.id);

  return (
    <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
          {learner.firstName[0]}
          {learner.lastName[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-content-primary">
            {learner.firstName} {learner.lastName}
          </h3>
          <p className="text-sm text-content-secondary">
            {learner.learnerNumber} · {learner.admissionNumber}
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          {learner.status}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Date of birth</dt>
          <dd className="mt-1 text-sm text-content-primary">{learner.dateOfBirth}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Admission date</dt>
          <dd className="mt-1 text-sm text-content-primary">{learner.admissionDate}</dd>
        </div>
      </dl>

      {medicalError && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {medicalError}
        </div>
      )}

      {medicalInformation && (
        <div className="mt-6 border-t border-border pt-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Medical information</h4>
          <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Allergies</dt>
              <dd className="mt-1 text-sm text-content-primary">{medicalInformation.allergies ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Medication</dt>
              <dd className="mt-1 text-sm text-content-primary">{medicalInformation.medication ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Medical conditions</dt>
              <dd className="mt-1 text-sm text-content-primary">{medicalInformation.medicalConditions ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Doctor</dt>
              <dd className="mt-1 text-sm text-content-primary">
                {[medicalInformation.doctorName, medicalInformation.doctorPhone].filter(Boolean).join(' · ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Medical aid</dt>
              <dd className="mt-1 text-sm text-content-primary">
                {[medicalInformation.medicalAidProvider, medicalInformation.medicalAidNumber].filter(Boolean).join(' · ') ||
                  '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Emergency medical notes</dt>
              <dd className="mt-1 text-sm text-content-primary">{medicalInformation.emergencyMedicalNotes ?? '—'}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
