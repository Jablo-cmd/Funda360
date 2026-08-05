import { useCallback, useEffect, useState } from 'react';
import { departmentService } from '@/features/employees/services/departmentService';
import type { Department } from '@/features/employees/types/employee.types';

export interface UseDepartmentsResult {
  departments: Department[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDepartments(schoolId: string | undefined): UseDepartmentsResult {
  const [departments, setDepartments] = useState<Department[]>([]);
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
      setDepartments(await departmentService.getDepartments(schoolId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments.');
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { departments, isLoading, error, refetch: load };
}
