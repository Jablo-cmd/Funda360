import type { Learner } from '@/features/learners/types/learner.types';

export interface LearnerOverviewSectionProps {
  learner: Learner;
  canViewSensitive: boolean;
}

export function LearnerOverviewSection({ learner, canViewSensitive }: LearnerOverviewSectionProps) {
  return (
    <dl className="grid grid-cols-1 gap-4 rounded-card border border-border bg-surface-raised p-5 sm:grid-cols-2">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Date of birth</dt>
        <dd className="mt-1 text-sm text-content-primary">{learner.dateOfBirth}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Gender</dt>
        <dd className="mt-1 text-sm text-content-primary">{learner.gender ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">ID number</dt>
        <dd className="mt-1 text-sm text-content-primary">
          {canViewSensitive ? (learner.idNumber ?? '—') : '••••••••••••'}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Passport</dt>
        <dd className="mt-1 text-sm text-content-primary">
          {canViewSensitive
            ? [learner.passportNumber, learner.passportCountry].filter(Boolean).join(' · ') || '—'
            : '••••••••••••'}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Nationality</dt>
        <dd className="mt-1 text-sm text-content-primary">{learner.nationality ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Home language</dt>
        <dd className="mt-1 text-sm text-content-primary">{learner.homeLanguage ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Boarding type</dt>
        <dd className="mt-1 text-sm capitalize text-content-primary">
          {learner.boardingType?.replace(/_/g, ' ') ?? '—'}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Transport</dt>
        <dd className="mt-1 text-sm text-content-primary">{learner.transportMode ?? '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Admission date</dt>
        <dd className="mt-1 text-sm text-content-primary">{learner.admissionDate}</dd>
      </div>
      {learner.statusReason && (
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Status reason</dt>
          <dd className="mt-1 text-sm text-content-primary">{learner.statusReason}</dd>
        </div>
      )}
    </dl>
  );
}
