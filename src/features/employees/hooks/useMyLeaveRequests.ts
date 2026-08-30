import { useCallback, useEffect, useState } from 'react';
import { leaveRequestService } from '@/features/employees/services/leaveRequestService';
import type { LeaveRequest } from '@/features/employees/types/leaveRequest.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseMyLeaveRequestsResult {
  requests: LeaveRequest[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** The caller's own leave request history — self-access, for the My Profile page. */
export function useMyLeaveRequests(employeeId: string | undefined): UseMyLeaveRequestsResult {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRequests(await leaveRequestService.getMyRequests(employeeId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load your leave requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { requests, isLoading, error, refetch: load };
}
