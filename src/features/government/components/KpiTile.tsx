import { cn } from '@/lib/cn';

import type { KpiTone } from '@/features/government/utils/kpiTone';

export interface KpiTileProps {
  label: string;
  value: string;
  /** One short line under the value: what it is counted from, or why it is flagged. */
  hint?: string;
  tone?: KpiTone;
}

const TONE_BAR: Record<KpiTone, string> = {
  neutral: 'bg-border-strong',
  good: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-700',
};

const TONE_TEXT: Record<KpiTone, string> = {
  neutral: 'sr-only',
  good: 'sr-only',
  warning: 'text-warning-600 dark:text-warning-500',
  danger: 'text-danger-600',
};

const TONE_LABEL: Record<KpiTone, string> = {
  neutral: '',
  good: 'Within threshold',
  warning: 'Needs attention',
  danger: 'Below threshold',
};

/** A key figure with a coloured status bar. The colour is never the only signal: the status is also written out. */
export function KpiTile({ label, value, hint, tone = 'neutral' }: KpiTileProps) {
  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-surface-raised p-4 pl-5 shadow-card dark:shadow-card-dark">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', TONE_BAR[tone])} />
      <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-content-primary">{value}</dd>
      {tone !== 'neutral' && TONE_LABEL[tone] && (
        <dd className={cn('mt-0.5 text-xs font-medium', TONE_TEXT[tone])}>{TONE_LABEL[tone]}</dd>
      )}
      {hint && <dd className="mt-1 text-xs text-content-tertiary">{hint}</dd>}
    </div>
  );
}
