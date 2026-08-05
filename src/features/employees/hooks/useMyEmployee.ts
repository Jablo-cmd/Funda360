import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import { employeeService } from '@/features/employees/services/employeeService';
import type { Employee } from '@/features/employees/types/employee.types';

export interface UseMyEmployeeResult {
  data: Employee | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyEmployee(): UseMyEmployeeResult {
  const { user } = useAuth();
  const [data, setData] = useState<Employee | null>(null);
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
      setData(await employeeService.getMyEmployee(user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your employee record.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
