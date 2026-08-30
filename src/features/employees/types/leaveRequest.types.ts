import type { LeaveType, LeaveRequestStatus } from '@/lib/database.types';

export type { LeaveType, LeaveRequestStatus };

export interface LeaveRequest {
  id: string;
  schoolId: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface CreateLeaveRequestInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ReviewLeaveRequestInput {
  status: Extract<LeaveRequestStatus, 'approved' | 'rejected'>;
  reviewNotes?: string | null;
}
