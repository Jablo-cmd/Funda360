import { supabase } from '@/lib/supabase';
import type { LeaveRequestRow, LeaveRequestInsert, LeaveRequestUpdate } from '@/lib/database.types';
import type {
  LeaveRequest,
  CreateLeaveRequestInput,
  ReviewLeaveRequestInput,
} from '@/features/employees/types/leaveRequest.types';

function toLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    schoolId: row.school_id,
    employeeId: row.employee_id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
  };
}

/** Every leave request for the school (HR/management view) — RLS (can_view_employees) already scopes this to the caller's tenant. */
async function getAllRequests(schoolId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toLeaveRequest);
}

/** The caller's own leave request history — self-access, no employee.view required (mirrors leave_requests_select's own self-access RLS clause). */
async function getMyRequests(employeeId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toLeaveRequest);
}

/**
 * Self-submitted or manager-logged — either way the server forces
 * status='pending' regardless of what's sent here (see
 * leave_requests_force_pending_on_insert()), so there's no client-side
 * status field to set.
 */
async function createRequest(schoolId: string, employeeId: string, input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  const payload: LeaveRequestInsert = {
    school_id: schoolId,
    employee_id: employeeId,
    leave_type: input.leaveType,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason,
  };
  const { data, error } = await supabase.from('leave_requests').insert(payload).select('*').single();
  if (error) throw error;
  return toLeaveRequest(data);
}

/** Approve or reject — reviewed_by/reviewed_at are never sent here, the server always derives them from the approving/rejecting manager (leave_requests_sync_review_fields()). Manager-only at the RLS layer; there is no self-service update path in this version. */
async function reviewRequest(id: string, input: ReviewLeaveRequestInput): Promise<LeaveRequest> {
  const payload: LeaveRequestUpdate = {
    status: input.status,
    review_notes: input.reviewNotes ?? null,
  };
  const { data, error } = await supabase.from('leave_requests').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toLeaveRequest(data);
}

export const leaveRequestService = { getAllRequests, getMyRequests, createRequest, reviewRequest };
