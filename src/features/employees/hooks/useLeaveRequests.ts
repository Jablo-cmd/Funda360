import { useCallback, useEffect, useState } from 'react';
import { leaveRequestService } from '@/features/employees/services/leaveRequestService';
import type { LeaveRequest } from '@/features/employees/types/leaveRequest.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseLeaveRequestsResult {
  requests: LeaveRequest[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Every leave request for the school (HR/management view). */
export function useLeaveRequests(schoolId: string | undefined): UseLeaveRequestsResult {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setRequests(await leaveRequestService.getAllRequests(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load leave requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { requests, isLoading, error, refetch: load };
}
