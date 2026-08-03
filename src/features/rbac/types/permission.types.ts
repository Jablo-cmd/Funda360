/**
 * Framework-level permission catalogue only — no business-module
 * permissions (learner/finance/attendance/etc.) until those epics exist.
 * Extend this union as each new module lands its own permission set.
 */
export type Permission =
  | 'school.view'
  | 'school.manage'
  | 'tenant.switch'
  | 'profile.view_own'
  | 'profile.update_own'
  | 'profile.view_any'
  | 'profile.manage_any'
  | 'academic.view'
  | 'academic.manage';
