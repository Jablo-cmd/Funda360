import { useCallback, useEffect, useState } from 'react';
import { employeeService } from '@/features/employees/services/employeeService';
import type { Employee } from '@/features/employees/types/employee.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface UseEmployeeResult {
  employee: Employee | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEmployee(employeeId: string | undefined): UseEmployeeResult {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setEmployee(await employeeService.getEmployee(employeeId));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load employee.'));
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { employee, isLoading, error, refetch: load };
}
