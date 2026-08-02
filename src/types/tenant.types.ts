import type { School } from '@/types/school.types';

export type TenantStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'inactive' | 'error';

/**
 * The resolved tenant context for the current session: which school is
 * active, and whether that's because the user natively belongs to it or
 * because a platform-level role (super/platform admin) is viewing it via
 * cross-tenant access (RBAC spec §6 — "All tenants" scope).
 */
export interface Tenant {
  id: string;
  school: School;
  isPlatformLevelAccess: boolean;
}
