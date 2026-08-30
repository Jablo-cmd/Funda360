import { describe, it, expect } from 'vitest';
import { isMfaRequiredForRole } from '@/features/rbac/constants/mfaRequiredRoles';

describe('isMfaRequiredForRole', () => {
  it('requires MFA for financial-manage roles', () => {
    expect(isMfaRequiredForRole('finance_manager')).toBe(true);
    expect(isMfaRequiredForRole('accountant')).toBe(true);
  });

  it('requires MFA for full school-admin roles', () => {
    expect(isMfaRequiredForRole('school_owner')).toBe(true);
    expect(isMfaRequiredForRole('principal')).toBe(true);
  });

  it('requires MFA for platform-wide admin roles', () => {
    expect(isMfaRequiredForRole('platform_administrator')).toBe(true);
    expect(isMfaRequiredForRole('super_administrator')).toBe(true);
  });

  it('does not require MFA for a teacher (no financial or admin power)', () => {
    expect(isMfaRequiredForRole('teacher')).toBe(false);
  });

  it('does not require MFA for a guardian', () => {
    expect(isMfaRequiredForRole('guardian')).toBe(false);
  });

  it('does not require MFA for vice_principal (behaviour-only, not full school-admin)', () => {
    expect(isMfaRequiredForRole('vice_principal')).toBe(false);
  });

  it('returns false for a null role', () => {
    expect(isMfaRequiredForRole(null)).toBe(false);
  });
});
