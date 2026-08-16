import { useCallback, useEffect, useState } from 'react';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { ClassTeacherAssignment } from '@/features/teaching/types/teaching.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseTeachingAssignmentsResult {
  assignments: ClassTeacherAssignment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTeachingAssignments(schoolId: string | undefined): UseTeachingAssignmentsResult {
  const [assignments, setAssignments] = useState<ClassTeacherAssignment[]>([]);
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
      setAssignments(await teachingAssignmentService.getAssignments(schoolId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load teaching assignments.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assignments, isLoading, error, refetch: load };
}
