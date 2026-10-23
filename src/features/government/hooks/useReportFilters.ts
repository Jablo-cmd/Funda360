import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GovernmentReportFilters } from '@/features/government/types/government.types';
import { filtersFromSearchParams, filtersToSearchParams } from '@/features/government/utils/reportFilters';

/** Report filters kept in the URL query string. */
export function useReportFilters(): [GovernmentReportFilters, (next: GovernmentReportFilters) => void, string] {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const filters = useMemo(() => filtersFromSearchParams(new URLSearchParams(query)), [query]);
  const setFilters = useCallback(
    (next: GovernmentReportFilters) => {
      const preserved = new URLSearchParams(params);
      const filterParams = filtersToSearchParams(next);
      for (const key of [...preserved.keys()]) {
        if (!['report'].includes(key)) preserved.delete(key);
      }
      filterParams.forEach((value, key) => preserved.set(key, value));
      setParams(preserved, { replace: true });
    },
    [params, setParams],
  );
  const filterQuery = filtersToSearchParams(filters).toString();
  return [filters, setFilters, filterQuery ? `?${filterQuery}` : ''];
}
