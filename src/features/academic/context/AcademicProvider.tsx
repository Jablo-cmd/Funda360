import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSchool } from '@/features/school/hooks/useSchool';
import { academicYearService } from '@/features/academic/services/academicYearService';
import { AcademicContext } from '@/features/academic/context/academicContext';
import type { AcademicContextValue } from '@/features/academic/context/academicContext';
import type { AcademicYear } from '@/features/academic/types/academic.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

/**
 * Loads off useSchool()'s already-resolved school id rather than deriving
 * tenant/school itself — same discipline as SchoolProvider composing over
 * TenantProvider (handbook §21). Nested inside SchoolProvider in App.tsx.
 *
 * Read-only, per the brief ("current academic year, academic years,
 * loading state, refresh"): mutations live in the per-entity services and
 * are called directly from pages/hooks, which then call refresh() here to
 * resync — the same shape UsersPage uses (refetch its own list after a
 * mutation) rather than routing every write through this context.
 */
export function AcademicProvider({ children }: { children: ReactNode }) {
  const { school, loading: schoolLoading } = useSchool();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!school) {
      setAcademicYears([]);
      setIsFetching(false);
      return;
    }
    setIsFetching(true);
    setError(null);
    try {
      const years = await academicYearService.getAcademicYears(school.id);
      setAcademicYears(years);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to load academic years.'));
    } finally {
      setIsFetching(false);
    }
  }, [school]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentAcademicYear = useMemo(
    () => academicYears.find((year) => year.isActive) ?? null,
    [academicYears],
  );

  const value = useMemo<AcademicContextValue>(
    () => ({
      currentAcademicYear,
      academicYears,
      loading: schoolLoading || isFetching,
      error,
      refresh: load,
    }),
    [currentAcademicYear, academicYears, schoolLoading, isFetching, error, load],
  );

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}
