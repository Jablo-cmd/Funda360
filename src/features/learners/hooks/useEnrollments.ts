import { useCallback, useEffect, useState } from 'react';
import { enrollmentService } from '@/features/learners/services/enrollmentService';
import type { LearnerEnrollment } from '@/features/learners/types/learner.types';

export interface UseEnrollmentsResult {
  enrollments: LearnerEnrollment[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEnrollments(learnerId: string | undefined): UseEnrollmentsResult {
  const [enrollments, setEnrollments] = useState<LearnerEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!learnerId) {
      setEnrollments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setEnrollments(await enrollmentService.getEnrollments(learnerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollment history.');
    } finally {
      setIsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { enrollments, isLoading, error, refetch: load };
}
