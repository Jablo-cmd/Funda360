import type { UserRole } from '@/features/auth/types/auth.types';
import type { Permission } from '@/features/rbac/types/permission.types';

/**
 * Elevated permissions per role. Every authenticated role additionally
 * carries an implicit baseline of `profile.view_own` / `profile.update_own`
 * (see hasPermission in utils/permissionHelpers.ts), so those two are
 * deliberately omitted here rather than repeated 24 times.
 *
 * Framework-level permissions only — no business-module permissions yet.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_administrator: [
    'school.view',
    'school.manage',
    'tenant.switch',
    'profile.view_any',
    'profile.manage_any',
    'academic.view',
    'academic.manage',
  ],
  platform_administrator: [
    'school.view',
    'school.manage',
    'tenant.switch',
    'profile.view_any',
    'profile.manage_any',
    'academic.view',
    'academic.manage',
  ],
  support_engineer: ['school.view', 'profile.view_any'],
  school_owner: [
    'school.view',
    'school.manage',
    'profile.view_any',
    'profile.manage_any',
    'academic.view',
    'academic.manage',
  ],
  principal: [
    'school.view',
    'school.manage',
    'profile.view_any',
    'profile.manage_any',
    'academic.view',
    'academic.manage',
  ],
  vice_principal: ['school.view', 'profile.view_any'],
  department_head: ['school.view', 'profile.view_any'],
  hr_manager: ['school.view', 'profile.view_any', 'profile.manage_any'],
  finance_manager: ['school.view'],
  accountant: ['school.view'],
  receptionist: ['school.view', 'profile.view_any'],
  admissions_officer: ['school.view', 'profile.view_any'],
  librarian: ['school.view'],
  transport_coordinator: ['school.view'],
  sports_coordinator: ['school.view'],
  medical_officer: ['school.view'],
  auditor: ['school.view', 'profile.view_any'],
  teacher: ['school.view', 'academic.view'],
  class_teacher: ['school.view', 'academic.view'],
  subject_teacher: ['school.view', 'academic.view'],
  parent: [],
  guardian: [],
  learner: [],
  guest: [],
};
