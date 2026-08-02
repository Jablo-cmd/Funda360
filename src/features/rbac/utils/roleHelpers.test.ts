import { describe, it, expect } from 'vitest';
import { USER_ROLES } from '@/features/auth/types/auth.types';
import { isValidRole, hasRole, isAtLeast } from '@/features/rbac/utils/roleHelpers';

describe('isValidRole', () => {
  it('accepts every canonical role slug', () => {
    for (const role of USER_ROLES) {
      expect(isValidRole(role)).toBe(true);
    }
  });

  it('rejects unknown strings and non-string values', () => {
    expect(isValidRole('wizard')).toBe(false);
    expect(isValidRole(42)).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
  });
});

describe('hasRole', () => {
  it('matches when role is in the allowed list', () => {
    expect(hasRole('principal', 'principal', 'vice_principal')).toBe(true);
  });

  it('does not match when role is absent from the allowed list', () => {
    expect(hasRole('teacher', 'principal', 'vice_principal')).toBe(false);
  });

  it('never matches a null or undefined role', () => {
    expect(hasRole(null, 'principal')).toBe(false);
    expect(hasRole(undefined, 'principal')).toBe(false);
  });
});

describe('isAtLeast', () => {
  it('is true when role outranks the threshold', () => {
    expect(isAtLeast('principal', 'teacher')).toBe(true);
  });

  it('is true when role exactly matches the threshold', () => {
    expect(isAtLeast('teacher', 'teacher')).toBe(true);
  });

  it('is false when role is junior to the threshold', () => {
    expect(isAtLeast('learner', 'teacher')).toBe(false);
  });

  it('is false for a null or undefined role regardless of threshold', () => {
    expect(isAtLeast(null, 'guest')).toBe(false);
    expect(isAtLeast(undefined, 'guest')).toBe(false);
  });

  it('places super_administrator at least as senior as every other role', () => {
    for (const role of USER_ROLES) {
      expect(isAtLeast('super_administrator', role)).toBe(true);
    }
  });

  it('places guest below every other role', () => {
    for (const role of USER_ROLES) {
      if (role === 'guest') continue;
      expect(isAtLeast('guest', role)).toBe(false);
    }
  });
});
