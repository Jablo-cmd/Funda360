import { useCallback, useEffect, useState } from 'react';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { governmentReportService } from '@/features/government/services/governmentReportService';
import { compactFilters } from '@/features/government/utils/reportFilters';
import type {
  ClassLearnerReport,
  GovernmentReport,
  GovernmentReportFilters,
  ProvinceOption,
  ProvincialReport,
  ReportingScope,
  SchoolReport,
} from '@/features/government/types/government.types';

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Runs `load` whenever `key` changes; drops responses that arrive after a newer request. */
function useAsync<T>(
  key: string | null,
  load: () => Promise<T>,
  fallbackError: string,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(key !== null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (key === null) {
      setData(null);
      setIsLoading(false);
      return;
    }
    let current = true;
    setIsLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (current) setData(result);
      })
      .catch((err: unknown) => {
        if (current) {
          setData(null);
          setError(getDbErrorMessage(err, fallbackError));
        }
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });
    return () => {
      current = false;
    };
    // `load` closes over the same values `key` encodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, isLoading, error, refetch };
}

export function useReportingScope(): AsyncState<ReportingScope> {
  return useAsync(
    'scope',
    () => governmentReportService.getScope(),
    'Could not load your reporting scope.',
  );
}

export function useGovernmentReport(
  filters: GovernmentReportFilters,
  enabled = true,
): AsyncState<GovernmentReport> {
  const key = enabled ? JSON.stringify(compactFilters(filters)) : null;
  return useAsync(
    key,
    () => governmentReportService.getReport(filters),
    'Could not load the report.',
  );
}

export function useSchoolReport(
  schoolId: string | undefined,
  filters: GovernmentReportFilters,
): AsyncState<SchoolReport> {
  const key = schoolId ? `${schoolId}|${JSON.stringify(compactFilters(filters))}` : null;
  return useAsync(
    key,
    () => governmentReportService.getSchoolReport(schoolId!, filters),
    'Could not load the school report.',
  );
}

export function useClassLearnerReport(
  classId: string | undefined,
  filters: GovernmentReportFilters,
): AsyncState<ClassLearnerReport> {
  const key = classId ? `${classId}|${JSON.stringify(compactFilters(filters))}` : null;
  return useAsync(
    key,
    () => governmentReportService.getClassLearnerReport(classId!, filters),
    'Could not load the class report.',
  );
}

export function useProvincialScope(): AsyncState<ProvinceOption[]> {
  return useAsync(
    'provincial-scope',
    () => governmentReportService.getProvincialScope(),
    'Could not load your provinces.',
  );
}

export function useProvincialReport(
  provinceId: string | undefined,
  filters: GovernmentReportFilters,
): AsyncState<ProvincialReport> {
  const key = provinceId ? `${provinceId}|${JSON.stringify(compactFilters(filters))}` : null;
  return useAsync(
    key,
    () => governmentReportService.getProvincialReport(provinceId!, filters),
    'Could not load the provincial report.',
  );
}
