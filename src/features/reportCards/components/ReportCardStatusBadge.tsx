import { REPORT_CARD_STATUS_LABELS } from '@/features/reportCards/types/reportCard.types';
import type { ReportCardStatus } from '@/features/reportCards/types/reportCard.types';

const STYLES: Record<ReportCardStatus, string> = {
  draft: 'bg-surface-sunken text-content-tertiary',
  teacher_review: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  hod_review: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  approved: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  published: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  archived: 'bg-surface-sunken text-content-tertiary line-through',
};

export function ReportCardStatusBadge({ status }: { status: ReportCardStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {REPORT_CARD_STATUS_LABELS[status]}
    </span>
  );
}
