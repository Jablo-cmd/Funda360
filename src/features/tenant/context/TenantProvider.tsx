import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { tenantService } from '@/features/tenant/services/tenantService';
import type { CreateSchoolInput } from '@/features/tenant/services/tenantService';
import { rbacService } from '@/features/rbac/services/rbacService';
import { TenantContext } from '@/features/tenant/context/tenantContext';
import type { TenantContextValue, TenantLoadStatus } from '@/features/tenant/context/tenantContext';
import type { School } from '@/types/school.types';
import type { Tenant } from '@/types/tenant.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { status: profileStatus, profile } = useProfile();

  const [status, setStatus] = useState<TenantLoadStatus>('idle');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableSchools, setAvailableSchools] = useState<School[]>([]);
  const [availableSchoolsLoading, setAvailableSchoolsLoading] = useState(false);

  const isPlatformLevel = rbacService.can(user?.role ?? null, 'tenant.switch');

  const loadTenant = useCallback(
    async (tenantId: string | null, isPlatformLevelAccess = false) => {
      if (!tenantId) {
        // No tenant on the profile: platform-level roles legitimately have
        // none (they operate across tenants); anyone else needs one assigned.
        setTenant(null);
        setStatus(isPlatformLevel ? 'ready' : 'missing');
        setError(null);
        return;
      }

      setStatus('loading');
      setError(null);
      try {
        const school = await tenantService.getSchoolById(tenantId);
        if (!school) {
          setTenant(null);
          setStatus('missing');
          return;
        }
        setTenant({ id: school.id, school, isPlatformLevelAccess });
        setStatus(school.status === 'active' ? 'ready' : 'inactive');
      } catch (err) {
        setTenant(null);
        setStatus('error');
        setError(getDbErrorMessage(err, 'Failed to load tenant.'));
      }
    },
    [isPlatformLevel],
  );

  // ProfileProvider legitimately re-fetches the profile in the background from
  // time to time (it re-derives on every auth event, including a routine
  // supabase-js token refresh) — each cycle passes through 'loading' then
  // 'loaded' again, even though nothing about the profile actually changed.
  // For a platform-level role (tenant_id is always NULL on their own profile
  // by design — they operate across tenants), re-running loadTenant(null) on
  // every such cycle would silently reset a tenant they explicitly picked via
  // switchTenant()/createSchool() straight back to "no school selected".
  // Once such a role has an active tenant, this effect steps aside; it only
  // re-derives from the profile when there's no tenant chosen yet, or when
  // the profile's own tenant assignment actually changes (a real reassignment,
  // or a tenant-scoped role, for whom this is the only source of truth).
  useEffect(() => {
    if (isPlatformLevel && tenant) return;

    if (profileStatus === 'loaded' && profile) {
      void loadTenant(profile.tenantId);
    } else if (profileStatus === 'missing' || profileStatus === 'error') {
      setTenant(null);
      setStatus('missing');
    } else if (profileStatus === 'idle') {
      setTenant(null);
      setStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileStatus, profile?.tenantId, loadTenant, isPlatformLevel]);

  useEffect(() => {
    if (!isPlatformLevel) {
      setAvailableSchools([]);
      setAvailableSchoolsLoading(false);
      return;
    }
    let isMounted = true;
    setAvailableSchoolsLoading(true);
    tenantService
      .listAvailableSchools()
      .then((schools) => {
        if (isMounted) setAvailableSchools(schools);
      })
      .catch(() => {
        if (isMounted) setAvailableSchools([]);
      })
      .finally(() => {
        if (isMounted) setAvailableSchoolsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isPlatformLevel]);

  const switchTenant = useCallback(
    async (schoolId: string) => {
      if (!isPlatformLevel) {
        console.warn('Tenant switching is restricted to platform-level roles.');
        return;
      }
      await loadTenant(schoolId, true);
    },
    [isPlatformLevel, loadTenant],
  );

  const createSchool = useCallback(
    async (input: CreateSchoolInput) => {
      if (!isPlatformLevel) {
        throw new Error('School creation is restricted to platform-level roles.');
      }
      const school = await tenantService.createSchool(input);
      setAvailableSchools((prev) => [...prev, school].sort((a, b) => a.name.localeCompare(b.name)));
      // Onboarding a school with no way to enter it would be a dead end —
      // creating implies selecting, same as every other "Add ___" flow in
      // the app landing the user on the record they just created.
      await loadTenant(school.id, true);
      return school;
    },
    [isPlatformLevel, loadTenant],
  );

  const refetch = useCallback(async () => {
    if (tenant) {
      await loadTenant(tenant.id, tenant.isPlatformLevelAccess);
    } else if (profile) {
      await loadTenant(profile.tenantId);
    }
  }, [tenant, profile, loadTenant]);

  const value = useMemo<TenantContextValue>(
    () => ({
      status,
      tenant,
      error,
      availableSchools,
      availableSchoolsLoading,
      switchTenant,
      createSchool,
      refetch,
    }),
    [
      status,
      tenant,
      error,
      availableSchools,
      availableSchoolsLoading,
      switchTenant,
      createSchool,
      refetch,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
