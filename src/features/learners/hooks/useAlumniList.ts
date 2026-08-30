import { useCallback, useEffect, useState } from 'react';
import { learnerService } from '@/features/learners/services/learnerService';
import type { Learner } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

const PAGE_SIZE = 20;

export interface UseAlumniListResult {
  alumni: Learner[];
  totalCount: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (search: string) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
}

/**
 * The Alumni registry (FND-SIS-008) — deliberately its own hook, not
 * useLearnersList reused with an initial filter, so status: 'graduated' can
 * never accidentally be widened or dropped by a caller passing a fresh
 * filters object (useLearnersList.setFilters replaces the whole object).
 * Reuses learnerService.getLearners's own paginated path, not
 * getLearnersByStatuses (the admissions pipeline's unpaginated helper) —
 * unlike an in-flight applicant pool, a school's alumni only grows over
 * the decades and has no reason to stay small.
 */
export function useAlumniList(schoolId: string | undefined): UseAlumniListResult {
  const [search, setSearchState] = useState('');
  const [page, setPage] = useState(1);
  const [alumni, setAlumni] = useState<Learner[]>([]);
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
      const result = await learnerService.getLearners(schoolId, { status: 'graduated', search }, page, PAGE_SIZE);
      setAlumni(result.learners);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load the alumni registry.'));
    } finally {
      setIsLoading(false);
    }
  }, [schoolId, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPage(1);
  }, []);

  return { alumni, totalCount, page, pageSize: PAGE_SIZE, isLoading, error, search, setSearch, setPage, refetch: load };
}
