import { USER_ROLES } from '@/features/auth/types/auth.types';
import type { UserRole } from '@/features/auth/types/auth.types';
import { ROLE_RANK } from '@/features/rbac/constants/roleHierarchy';

export function isValidRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** True when `role` is one of `allowed`. Null/undefined role never matches. */
export function hasRole(role: UserRole | null | undefined, ...allowed: UserRole[]): boolean {
  return role != null && allowed.includes(role);
}

/** True when `role` outranks or matches `threshold` in seniority — see ROLE_RANK. */
export function isAtLeast(role: UserRole | null | undefined, threshold: UserRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[threshold];
}
