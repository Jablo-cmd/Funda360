import { useCallback, useEffect, useState } from 'react';
import { userService } from '@/features/users/services/userService';
import type { UsersListFilters } from '@/features/users/types/user.types';
import type { Profile } from '@/types/profile.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

const PAGE_SIZE = 20;

export interface UseUsersListResult {
  users: Profile[];
  totalCount: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  filters: UsersListFilters;
  setFilters: (filters: UsersListFilters) => void;
  setPage: (page: number) => void;
  refetch: () => Promise<void>;
}

export function useUsersList(): UseUsersListResult {
  const [filters, setFiltersState] = useState<UsersListFilters>({});
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await userService.getUsers(filters, page, PAGE_SIZE);
      setUsers(result.users);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load users.'));
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: UsersListFilters) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  return {
    users,
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
