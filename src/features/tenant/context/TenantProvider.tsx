import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import { useProfile } from '@/features/profile/context/profileContext';
import { tenantService } from '@/features/tenant/services/tenantService';
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

  useEffect(() => {
    if (profileStatus === 'loaded' && profile) {
      void loadTenant(profile.tenantId);
    } else if (profileStatus === 'missing' || profileStatus === 'error') {
      setTenant(null);
      setStatus('missing');
    } else if (profileStatus === 'idle') {
      setTenant(null);
      setStatus('idle');
    }
  }, [profileStatus, profile, loadTenant]);

  useEffect(() => {
    if (!isPlatformLevel) {
      setAvailableSchools([]);
      return;
    }
    let isMounted = true;
    tenantService
      .listAvailableSchools()
      .then((schools) => {
        if (isMounted) setAvailableSchools(schools);
      })
      .catch(() => {
        if (isMounted) setAvailableSchools([]);
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

  const refetch = useCallback(async () => {
    if (tenant) {
      await loadTenant(tenant.id, tenant.isPlatformLevelAccess);
    } else if (profile) {
      await loadTenant(profile.tenantId);
    }
  }, [tenant, profile, loadTenant]);

  const value = useMemo<TenantContextValue>(
    () => ({ status, tenant, error, availableSchools, switchTenant, refetch }),
    [status, tenant, error, availableSchools, switchTenant, refetch],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
