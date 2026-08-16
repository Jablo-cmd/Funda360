import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { ClassTeacherAssignment } from '@/features/teaching/types/teaching.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseMyTeachingAssignmentsResult {
  data: ClassTeacherAssignment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Self-service: "my classes" for the signed-in teacher — same shape as useMyEmployee/useMyLearners. */
export function useMyTeachingAssignments(): UseMyTeachingAssignmentsResult {
  const { user } = useAuth();
  const [data, setData] = useState<ClassTeacherAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setData(await teachingAssignmentService.getMyAssignments(user.id));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load your teaching assignments.'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
