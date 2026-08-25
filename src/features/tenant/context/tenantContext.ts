import { createContext, useContext } from 'react';
import type { School } from '@/types/school.types';
import type { Tenant } from '@/types/tenant.types';
import type { CreateSchoolInput } from '@/features/tenant/services/tenantService';

export type TenantLoadStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'inactive' | 'error';

export interface TenantContextValue {
  status: TenantLoadStatus;
  tenant: Tenant | null;
  error: string | null;
  /** Populated only for platform-level roles (RBAC `tenant.switch` permission). */
  availableSchools: School[];
  /** True while the initial (or a refreshed) availableSchools fetch is in flight. */
  availableSchoolsLoading: boolean;
  switchTenant: (schoolId: string) => Promise<void>;
  /** Onboards a new school and immediately switches the active tenant to it. Platform-level roles only. */
  createSchool: (input: CreateSchoolInput) => Promise<School>;
  refetch: () => Promise<void>;
}

export const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
