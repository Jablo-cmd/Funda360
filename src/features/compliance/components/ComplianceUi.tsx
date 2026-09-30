import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { ControlStatus } from '@/features/compliance/types/compliance.types';
import { STATUS_LABEL } from '@/features/compliance/utils/frameworkStatus';

const STATUS_STYLES: Record<ControlStatus, string> = {
  ready: 'border-success-500/40 bg-success-500/10 text-green-800 dark:text-green-300',
  attention:
    'border-warning-500/50 bg-warning-50 text-amber-800 dark:bg-warning-500/10 dark:text-amber-300',
  action_required:
    'border-danger-500/40 bg-danger-50 text-red-800 dark:bg-danger-500/10 dark:text-red-300',
};

export function StatusPill({ status, className }: { status: ControlStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Small uppercase label + value, used for KPI tiles on the Trust Center. */
export function MetricTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'alert';
}) {
  return (
    <div
      className={cn(
        'rounded-card border bg-surface-raised p-4 shadow-card dark:shadow-card-dark',
        tone === 'alert' ? 'border-accent-500' : 'border-border',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-content-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-content-secondary">{hint}</p>}
    </div>
  );
}

export function SectionTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-content-primary">{children}</h2>
      {description && <p className="mt-0.5 text-sm text-content-secondary">{description}</p>}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-content-secondary">
        {children}
      </td>
    </tr>
  );
}
