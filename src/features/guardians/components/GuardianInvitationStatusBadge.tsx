import type { GuardianInvitationDisplayStatus } from '@/features/guardians/types/guardian.types';

const LABELS: Record<GuardianInvitationDisplayStatus, string> = {
  not_invited: 'Not invited',
  pending: 'Invitation pending',
  expired: 'Invitation expired',
  revoked: 'Invitation revoked',
  accepted: 'Active',
};

const CLASSES: Record<GuardianInvitationDisplayStatus, string> = {
  not_invited: 'bg-surface-sunken text-content-tertiary',
  pending: 'bg-warning-500/10 text-warning-600',
  expired: 'bg-surface-sunken text-content-tertiary',
  revoked: 'bg-danger-500/10 text-danger-600',
  accepted: 'bg-success-500/10 text-success-500',
};

export interface GuardianInvitationStatusBadgeProps {
  status: GuardianInvitationDisplayStatus;
}

export function GuardianInvitationStatusBadge({ status }: GuardianInvitationStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${CLASSES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
