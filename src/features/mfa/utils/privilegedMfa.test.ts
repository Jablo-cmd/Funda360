import { describe, expect, it } from 'vitest';
import { privilegedMfaState, requiresPrivilegedMfa } from '@/features/mfa/utils/privilegedMfa';

describe('privileged MFA for government reporting', () => {
  it('applies to education officials and platform administrators only', () => {
    expect(requiresPrivilegedMfa('education_official')).toBe(true);
    expect(requiresPrivilegedMfa('platform_owner')).toBe(true);
    expect(requiresPrivilegedMfa('super_administrator')).toBe(true);
    expect(requiresPrivilegedMfa('platform_administrator')).toBe(true);
    expect(requiresPrivilegedMfa('principal')).toBe(false);
    expect(requiresPrivilegedMfa('school_owner')).toBe(false);
    expect(requiresPrivilegedMfa(null)).toBe(false);
  });

  it('lets an aal2 session through', () => {
    expect(privilegedMfaState('education_official', 'aal2', true)).toBe('allowed');
  });

  it('sends a user with a factor but an aal1 session to the challenge', () => {
    expect(privilegedMfaState('education_official', 'aal1', true)).toBe('challenge');
  });

  it('requires enrolment when there is no factor', () => {
    expect(privilegedMfaState('platform_administrator', 'aal1', false)).toBe('enrol');
    expect(privilegedMfaState('education_official', 'aal1', null)).toBe('enrol');
  });

  it('waits while the assurance level is unknown', () => {
    expect(privilegedMfaState('education_official', null, null)).toBe('loading');
  });

  it('does not affect school leadership', () => {
    expect(privilegedMfaState('principal', 'aal1', false)).toBe('allowed');
  });
});
