import type { UserRole } from '@/features/auth/types/auth.types';

/**
 * Which composed dashboard a role lands on. Guardians and learners never
 * reach `/dashboard` (RedirectGuardiansToParentPortal sends them to their
 * portal), so they have no persona here.
 *
 * `minimal` is the honest fallback for roles whose implemented surface
 * today is only messaging / announcements / profile — it advertises
 * nothing that isn't built.
 */
export type DashboardPersona =
  | 'platform'
  | 'principal'
  | 'teacher'
  | 'finance'
  | 'hr'
  | 'admissions'
  | 'minimal';

const PERSONA_BY_ROLE: Partial<Record<UserRole, DashboardPersona>> = {
  super_administrator: 'platform',
  platform_administrator: 'platform',
  school_owner: 'principal',
  principal: 'principal',
  // vice_principal carries only learner / behaviour / report-card-view /
  // admission-view permissions today — it gets the nav-derived minimal
  // dashboard, not the whole-school KPI dashboard whose attendance /
  // finance / class figures it cannot see anyway.
  teacher: 'teacher',
  class_teacher: 'teacher',
  subject_teacher: 'teacher',
  finance_manager: 'finance',
  accountant: 'finance',
  hr_manager: 'hr',
  admissions_officer: 'admissions',
  receptionist: 'admissions',
};

export function resolveDashboardPersona(role: UserRole | null | undefined): DashboardPersona {
  if (!role) return 'minimal';
  return PERSONA_BY_ROLE[role] ?? 'minimal';
}
