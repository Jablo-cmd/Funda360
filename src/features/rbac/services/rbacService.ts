import { hasRole, isAtLeast } from '@/features/rbac/utils/roleHelpers';
import { hasPermission, hasAnyPermission, hasAllPermissions, can } from '@/features/rbac/utils/permissionHelpers';

/**
 * Facade over the pure RBAC helpers (features/rbac/utils), exposed as a
 * service for architectural consistency with tenantService/profileService —
 * providers only ever import from `services/*`. Unlike those two, this one
 * never touches Supabase: role/permission logic is local and synchronous,
 * so there's nothing here beyond delegation (no duplicated logic).
 */
export const rbacService = {
  hasRole,
  isAtLeast,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  can,
};
