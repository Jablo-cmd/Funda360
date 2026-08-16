import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTenant } from '@/features/tenant/context/tenantContext';
import { schoolService } from '@/features/school/services/schoolService';
import { SchoolContext } from '@/features/school/context/schoolContext';
import type { SchoolContextValue } from '@/features/school/context/schoolContext';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type {
  SchoolProfileUpdateInput,
  SchoolSettingsUpdateInput,
} from '@/features/school/types/school.types';
import type { School } from '@/types/school.types';

/**
 * Thin composition over TenantProvider rather than an independent fetch:
 * TenantProvider already loads the active school (it's the RLS-scoping
 * source of truth used everywhere), so re-fetching here would just be a
 * second network round-trip for the same row. SchoolProvider reshapes that
 * state for the School Administration feature and adds the write
 * operations TenantProvider intentionally doesn't have — tenant context is
 * read-only by design.
 *
 * After a save, this applies the row `schoolService` already returns
 * directly to local state instead of calling `tenant.refetch()` — refetch
 * flips TenantProvider's status to 'loading', which makes TenantGate swap
 * `<Outlet/>` for a spinner and unmount the page mid-save (verified while
 * testing the School Profile form: the save silently "worked" but the
 * success banner never appeared because the form had just been remounted).
 */
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { tenant, status: tenantStatus, error: tenantError, refetch } = useTenant();
  const [localSchool, setLocalSchool] = useState<School | null>(tenant?.school ?? null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Re-sync whenever TenantProvider loads a (possibly different) school —
  // initial load, sign-in, or an explicit tenant switch.
  useEffect(() => {
    setLocalSchool(tenant?.school ?? null);
  }, [tenant]);

  const loading = tenantStatus === 'idle' || tenantStatus === 'loading';

  const updateSchool = useCallback(
    async (updates: SchoolProfileUpdateInput) => {
      if (!localSchool) throw new Error('No active school to update.');
      setIsMutating(true);
      setMutationError(null);
      try {
        const updated = await schoolService.updateSchool(localSchool.id, updates);
        setLocalSchool(updated);
      } catch (err) {
        setMutationError(getDbErrorMessage(err, 'Failed to update school.'));
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [localSchool],
  );

  const updateSchoolSettings = useCallback(
    async (updates: SchoolSettingsUpdateInput) => {
      if (!localSchool) throw new Error('No active school to update.');
      setIsMutating(true);
      setMutationError(null);
      try {
        const updated = await schoolService.updateSchoolSettings(localSchool.id, updates);
        setLocalSchool(updated);
      } catch (err) {
        setMutationError(getDbErrorMessage(err, 'Failed to update school settings.'));
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [localSchool],
  );

  const value = useMemo<SchoolContextValue>(
    () => ({
      school: localSchool,
      loading: loading || isMutating,
      error: mutationError ?? tenantError,
      refresh: refetch,
      updateSchool,
      updateSchoolSettings,
    }),
    [
      localSchool,
      loading,
      isMutating,
      mutationError,
      tenantError,
      refetch,
      updateSchool,
      updateSchoolSettings,
    ],
  );

  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}
