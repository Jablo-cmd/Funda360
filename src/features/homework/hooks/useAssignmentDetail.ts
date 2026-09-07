import { useCallback, useEffect, useState } from 'react';
import { homeworkService } from '@/features/homework/services/homeworkService';
import type {
  Assignment,
  AssignmentResource,
  AssignmentSubmission,
} from '@/features/homework/types/homework.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseAssignmentDetailResult {
  assignment: Assignment | null;
  resources: AssignmentResource[];
  submissions: AssignmentSubmission[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssignmentDetail(
  id: string | undefined,
  options: { withSubmissions?: boolean } = {},
): UseAssignmentDetailResult {
  const withSubmissions = options.withSubmissions ?? true;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [resources, setResources] = useState<AssignmentResource[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await homeworkService.getAssignment(id);
      setAssignment(detail.assignment);
      setResources(detail.resources);
      if (withSubmissions) {
        setSubmissions(await homeworkService.listSubmissions(id));
      }
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load this assignment.'));
    } finally {
      setIsLoading(false);
    }
  }, [id, withSubmissions]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assignment, resources, submissions, isLoading, error, refetch: load };
}
