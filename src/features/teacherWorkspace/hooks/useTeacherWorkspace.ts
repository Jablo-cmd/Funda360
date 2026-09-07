import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import {
  teacherWorkspaceService,
  type TeacherWorkspace,
} from '@/features/teacherWorkspace/services/teacherWorkspaceService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseTeacherWorkspaceResult {
  workspace: TeacherWorkspace | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTeacherWorkspace(
  schoolId: string | undefined,
  academicYearId: string | undefined,
): UseTeacherWorkspaceResult {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !schoolId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setWorkspace(await teacherWorkspaceService.getWorkspace(user.id, schoolId, academicYearId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load your workspace.'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, schoolId, academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { workspace, isLoading, error, refetch: load };
}
