import type { UserRole } from '@/features/auth/types/auth.types';

/**
 * Roles that must hold an MFA (aal2) session before reaching government
 * reporting. The database enforces the same list (is_privileged_reporting_role
 * in 20261009091000_government_reporting.sql); this copy only decides which
 * screen to show.
 */
export const PRIVILEGED_MFA_ROLES: readonly UserRole[] = [
  'education_official',
  'platform_owner',
  'super_administrator',
  'platform_administrator',
];

export function requiresPrivilegedMfa(role: UserRole | null | undefined): boolean {
  return role !== null && role !== undefined && PRIVILEGED_MFA_ROLES.includes(role);
}

export type PrivilegedMfaState = 'allowed' | 'loading' | 'challenge' | 'enrol';

/** What the government-reporting guard should do for this session. */
export function privilegedMfaState(
  role: UserRole | null | undefined,
  assuranceLevel: 'aal1' | 'aal2' | null,
  hasMfaEnabled: boolean | null,
): PrivilegedMfaState {
  if (!requiresPrivilegedMfa(role)) return 'allowed';
  if (assuranceLevel === null) return 'loading';
  if (assuranceLevel === 'aal2') return 'allowed';
  return hasMfaEnabled ? 'challenge' : 'enrol';
}
