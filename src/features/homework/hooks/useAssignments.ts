import { useCallback, useEffect, useState } from 'react';
import type { AssignmentStatus } from '@/lib/database.types';
import { homeworkService } from '@/features/homework/services/homeworkService';
import type { Assignment } from '@/features/homework/types/homework.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAssignmentsResult {
  assignments: Assignment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssignments(
  schoolId: string | undefined,
  filters: { classId?: string; subjectId?: string; status?: AssignmentStatus } = {},
): UseAssignmentsResult {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setAssignments(await homeworkService.listAssignments(schoolId, filters));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load assignments.'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, filters.classId, filters.subjectId, filters.status]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assignments, isLoading, error, refetch: load };
}
