import { describe, it, expect } from 'vitest';
import { resolveDashboardPersona } from '@/features/dashboard/resolveDashboardPersona';
import { USER_ROLES } from '@/features/auth/types/auth.types';

describe('resolveDashboardPersona', () => {
  it('maps the pilot roles to their workspace', () => {
    expect(resolveDashboardPersona('principal')).toBe('principal');
    expect(resolveDashboardPersona('school_owner')).toBe('principal');
    expect(resolveDashboardPersona('teacher')).toBe('teacher');
    expect(resolveDashboardPersona('class_teacher')).toBe('teacher');
    expect(resolveDashboardPersona('accountant')).toBe('finance');
    expect(resolveDashboardPersona('finance_manager')).toBe('finance');
    expect(resolveDashboardPersona('hr_manager')).toBe('hr');
    expect(resolveDashboardPersona('admissions_officer')).toBe('admissions');
    expect(resolveDashboardPersona('receptionist')).toBe('admissions');
    expect(resolveDashboardPersona('super_administrator')).toBe('platform');
    expect(resolveDashboardPersona('platform_administrator')).toBe('platform');
  });

  it('falls back to minimal for roles whose dashboard is nav-derived, and for null', () => {
    expect(resolveDashboardPersona('librarian')).toBe('minimal');
    expect(resolveDashboardPersona('medical_officer')).toBe('minimal');
    expect(resolveDashboardPersona('support_engineer')).toBe('minimal');
    expect(resolveDashboardPersona('department_head')).toBe('minimal');
    expect(resolveDashboardPersona('vice_principal')).toBe('minimal');
    expect(resolveDashboardPersona(null)).toBe('minimal');
  });

  it('resolves a persona for every role in the catalogue', () => {
    for (const role of USER_ROLES) {
      expect(resolveDashboardPersona(role)).toBeTruthy();
    }
  });
});
