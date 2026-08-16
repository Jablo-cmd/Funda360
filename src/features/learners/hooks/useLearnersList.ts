import { useCallback, useEffect, useState } from 'react';
import { learnerService } from '@/features/learners/services/learnerService';
import type { Learner, LearnersListFilters } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

const PAGE_SIZE = 20;

export interface UseLearnersListResult {
  learners: Learner[];
  totalCount: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  filters: LearnersListFilters;
  setFilters: (filters: LearnersListFilters) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
}

export function useLearnersList(schoolId: string | undefined): UseLearnersListResult {
  const [filters, setFiltersState] = useState<LearnersListFilters>({});
  const [page, setPage] = useState(1);
  const [learners, setLearners] = useState<Learner[]>([]);
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
      const result = await learnerService.getLearners(schoolId, filters, page, PAGE_SIZE);
      setLearners(result.learners);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load learners.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: LearnersListFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  return {
    learners,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    isLoading,
    error,
    filters,
    setFilters,
    setPage,
    refetch: load,
  };
}
