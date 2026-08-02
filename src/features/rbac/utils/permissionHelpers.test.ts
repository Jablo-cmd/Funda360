import { describe, it, expect } from 'vitest';
import { USER_ROLES } from '@/features/auth/types/auth.types';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  can,
} from '@/features/rbac/utils/permissionHelpers';

describe('hasPermission', () => {
  it('grants the self-service baseline to every role, including a null role', () => {
    for (const role of [...USER_ROLES, null]) {
      expect(hasPermission(role, 'profile.view_own')).toBe(true);
      expect(hasPermission(role, 'profile.update_own')).toBe(true);
    }
  });

  it('grants elevated permissions only to roles that carry them', () => {
    expect(hasPermission('principal', 'school.manage')).toBe(true);
    expect(hasPermission('teacher', 'school.manage')).toBe(false);
  });

  it('denies every non-baseline permission for a null role', () => {
    expect(hasPermission(null, 'school.view')).toBe(false);
    expect(hasPermission(null, 'tenant.switch')).toBe(false);
  });

  it('grants tenant.switch only to platform-level roles', () => {
    expect(hasPermission('super_administrator', 'tenant.switch')).toBe(true);
    expect(hasPermission('platform_administrator', 'tenant.switch')).toBe(true);
    expect(hasPermission('school_owner', 'tenant.switch')).toBe(false);
    expect(hasPermission('principal', 'tenant.switch')).toBe(false);
  });

  it('never grants business-module permissions (there are none defined yet)', () => {
    // @ts-expect-error — intentionally probing an out-of-catalogue permission
    expect(hasPermission('super_administrator', 'learner.view')).toBe(false);
  });
});

describe('hasAnyPermission / hasAllPermissions', () => {
  it('hasAnyPermission is true if at least one permission matches', () => {
    expect(hasAnyPermission('teacher', ['school.manage', 'school.view'])).toBe(true);
  });

  it('hasAnyPermission is false if none match', () => {
    expect(hasAnyPermission('guest', ['school.manage', 'tenant.switch'])).toBe(false);
  });

  it('hasAllPermissions requires every permission to match', () => {
    expect(hasAllPermissions('principal', ['school.view', 'school.manage'])).toBe(true);
    expect(hasAllPermissions('teacher', ['school.view', 'school.manage'])).toBe(false);
  });
});

describe('can', () => {
  it('is an alias for hasPermission', () => {
    expect(can('principal', 'school.manage')).toBe(hasPermission('principal', 'school.manage'));
    expect(can('teacher', 'school.manage')).toBe(hasPermission('teacher', 'school.manage'));
  });
});
