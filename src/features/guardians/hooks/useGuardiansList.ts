import { useCallback, useEffect, useState } from 'react';
import { guardianDirectoryService } from '@/features/guardians/services/guardianDirectoryService';
import type { GuardianDirectoryEntry, GuardiansListFilters } from '@/features/guardians/types/guardian.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

const PAGE_SIZE = 20;

export interface UseGuardiansListResult {
  guardians: GuardianDirectoryEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  filters: GuardiansListFilters;
  setFilters: (filters: GuardiansListFilters) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
}

export function useGuardiansList(schoolId: string | undefined): UseGuardiansListResult {
  const [filters, setFiltersState] = useState<GuardiansListFilters>({});
  const [page, setPage] = useState(1);
  const [guardians, setGuardians] = useState<GuardianDirectoryEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
      const result = await guardianDirectoryService.listGuardians(schoolId, filters, page, PAGE_SIZE);
      setGuardians(result.guardians);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load guardians.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: GuardiansListFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  return { guardians, totalCount, page, pageSize: PAGE_SIZE, isLoading, error, filters, setFilters, setPage, refetch: load };
}
