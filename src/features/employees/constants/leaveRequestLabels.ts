import type { LeaveType, LeaveRequestStatus } from '@/features/employees/types/leaveRequest.types';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  family_responsibility: 'Family responsibility leave',
  unpaid: 'Unpaid leave',
  other: 'Other',
};

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const LEAVE_STATUS_STYLES: Record<LeaveRequestStatus, string> = {
  pending: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500',
  approved: 'bg-success-500/10 text-success-500',
  rejected: 'bg-danger-50 text-danger-600',
  cancelled: 'bg-surface-sunken text-content-tertiary',
};
