import type { UserRole } from '@/features/auth/types/auth.types';

/**
 * FND-ARCH-003 — the P0 gate before FND-PAY-001 (live payments). Two
 * groups: roles that can manage financial data
 * (`learner.manage_financial`: school_owner, finance_manager, accountant)
 * and roles with full school-admin power (`school.manage` +
 * `profile.manage_any` — school_owner, principal — the two roles that can
 * create/manage other staff accounts, a genuine account-takeover-risk
 * capability), plus the two top-tier platform-wide admin roles. Not every
 * `.manage`-tier role: a teacher who can mark a register wrong is a
 * data-quality problem, not the kind of account-takeover risk MFA exists
 * to close.
 *
 * "Required" here is a soft requirement enforced in the UI (a banner
 * nudging enrollment, checked by isMfaRequiredForRole below) — not yet a
 * hard block on app access for the unenrolled. Deliberately: forcing every
 * qualifying role to enroll before touching the app today would lock out
 * every existing demo account instantly, and FND-PAY-001 (the actual
 * reason this gate exists) is itself still externally blocked, so there
 * is no live financial exposure yet that demands immediate hard
 * enforcement. Hard-blocking unenrolled access for these roles is the
 * documented next step once FND-PAY-001's gateway decision is made, not
 * silently dropped.
 */
const MFA_REQUIRED_ROLES: readonly UserRole[] = [
  'school_owner',
  'principal',
  'finance_manager',
  'accountant',
  'platform_administrator',
  'super_administrator',
];

export function isMfaRequiredForRole(role: UserRole | null): boolean {
  return role !== null && MFA_REQUIRED_ROLES.includes(role);
}
