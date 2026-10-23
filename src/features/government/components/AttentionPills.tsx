import type { AttentionReason } from '@/features/government/types/government.types';
import { ATTENTION_LABELS } from '@/features/government/utils/reportDefinitions';

const PILL: Record<AttentionReason, string> = {
  low_attendance: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15',
  low_performance: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15',
  overdue_interventions: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  data_quality: 'bg-surface-sunken text-content-secondary',
};

/** Why a school is flagged, as text pills ("On track" when nothing is flagged). */
export function AttentionPills({ reasons }: { reasons: AttentionReason[] }) {
  if (reasons.length === 0) {
    return <span className="text-xs font-medium text-success-500">On track</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Needs attention">
      {reasons.map((reason) => (
        <li key={reason} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PILL[reason]}`}>
          {ATTENTION_LABELS[reason]}
        </li>
      ))}
    </ul>
  );
}
