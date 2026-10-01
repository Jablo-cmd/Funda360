import type { ReactNode } from 'react';
import type { ContentStatus } from '@/lib/database.types';
import { STATUS_LABEL } from '@/features/content-studio/utils/studio';

export const selectClass =
  'focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm text-content-primary';
export const textareaClass =
  'focus-ring min-h-24 w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-content-primary';

const STATUS_CLASSES: Record<ContentStatus, string> = {
  draft: 'bg-surface-sunken text-content-secondary',
  review: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-500',
  approved: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  published: 'bg-success-500/10 text-success-500',
  retired: 'bg-surface-sunken text-content-tertiary',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: 'authored' | 'ai_draft' }) {
  return (
    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-content-secondary">
      {origin === 'ai_draft' ? 'AI-assisted draft' : 'Written by people'}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-content-primary">
      {label}
      {children}
    </label>
  );
}

export function ActionButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>;
}

export function ButtonSlot({ children }: { children: ReactNode }) {
  return <div className="sm:w-auto sm:min-w-[10rem]">{children}</div>;
}
