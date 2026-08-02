import type { SchoolStatus } from '@/types/school.types';

const STATUS_LABELS: Record<SchoolStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

export function getSchoolStatusLabel(status: SchoolStatus): string {
  return STATUS_LABELS[status];
}
