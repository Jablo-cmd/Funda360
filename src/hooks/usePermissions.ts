import { useMemo } from 'react';
import { useAuth } from '@/features/auth/context/authContext';
import type { UserRole } from '@/features/auth/types/auth.types';
import { rbacService } from '@/features/rbac/services/rbacService';
import type { Permission } from '@/features/rbac/types/permission.types';

export interface UsePermissionsResult {
  role: UserRole | null;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
  isAtLeast: (threshold: UserRole) => boolean;
}

/** Combines the authenticated user's role (auth feature) with the RBAC service into one hook. */
export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth();
  const role = user?.role ?? null;

  return useMemo(
    () => ({
      role,
      can: (permission: Permission) => rbacService.can(role, permission),
      canAny: (permissions: Permission[]) => rbacService.hasAnyPermission(role, permissions),
      canAll: (permissions: Permission[]) => rbacService.hasAllPermissions(role, permissions),
      hasRole: (...roles: UserRole[]) => rbacService.hasRole(role, ...roles),
      isAtLeast: (threshold: UserRole) => rbacService.isAtLeast(role, threshold),
    }),
    [role],
  );
}
