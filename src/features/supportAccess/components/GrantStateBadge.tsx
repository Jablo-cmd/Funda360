import { cn } from '@/lib/cn';
import { GRANT_STATE_LABEL, type GrantState } from '@/features/supportAccess/utils/grantState';

const STATE_CLASS: Record<GrantState, string> = {
  pending: 'bg-warning-500/10 text-warning-600',
  active: 'bg-success-500/10 text-success-500',
  expired: 'bg-surface-sunken text-content-tertiary',
  declined: 'bg-surface-sunken text-content-tertiary',
  revoked: 'bg-surface-sunken text-content-tertiary',
};

export function GrantStateBadge({ state }: { state: GrantState }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATE_CLASS[state],
      )}
    >
      {GRANT_STATE_LABEL[state]}
    </span>
  );
}
