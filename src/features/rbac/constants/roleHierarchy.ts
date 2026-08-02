import type { UserRole } from '@/features/auth/types/auth.types';

/**
 * Approximate total order over roles for "at least as senior as" checks.
 * Not a strict org chart — side-branch roles (finance, HR, receptionist,
 * coordinators, etc.) are ranked by typical seniority/trust level, not by
 * module scope. Gaps of 5 leave room to insert roles later without
 * renumbering the table.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  super_administrator: 100,
  platform_administrator: 95,
  support_engineer: 90,
  school_owner: 85,
  principal: 80,
  vice_principal: 75,
  department_head: 70,
  hr_manager: 65,
  finance_manager: 65,
  accountant: 60,
  admissions_officer: 60,
  librarian: 60,
  transport_coordinator: 60,
  sports_coordinator: 60,
  medical_officer: 60,
  receptionist: 60,
  auditor: 55,
  teacher: 50,
  class_teacher: 50,
  subject_teacher: 50,
  parent: 30,
  guardian: 30,
  learner: 20,
  guest: 10,
};
