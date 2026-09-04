import { ADMISSION_STATUS_LABELS } from '@/features/admissions/types/admission.types';
import type { AdmissionApplicationStatus } from '@/features/admissions/types/admission.types';

const STYLES: Record<AdmissionApplicationStatus, string> = {
  draft: 'bg-surface-sunken text-content-tertiary',
  submitted: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  under_review: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  incomplete: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  interview_required: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  assessment_required: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  waitlisted: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  accepted: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  rejected: 'bg-danger-50 text-danger-600',
  withdrawn: 'bg-surface-sunken text-content-tertiary line-through',
  enrolled: 'bg-success-600 text-white',
};

export function ApplicationStatusBadge({ status }: { status: AdmissionApplicationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {ADMISSION_STATUS_LABELS[status]}
    </span>
  );
}
