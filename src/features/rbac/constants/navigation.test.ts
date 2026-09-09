import { describe, it, expect } from 'vitest';
import { NAV_MODEL, resolveNavForRole } from '@/features/rbac/constants/navigation';
import type { UserRole } from '@/features/auth/types/auth.types';

function labels(role: UserRole | null): string[] {
  return resolveNavForRole(role).flatMap((g) => g.items.map((i) => i.label));
}

describe('resolveNavForRole', () => {
  it('never renders an empty group', () => {
    for (const role of ['principal', 'teacher', 'accountant', 'hr_manager', 'librarian', null] as const) {
      for (const group of resolveNavForRole(role)) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every role Dashboard, Messages and My Profile', () => {
    for (const role of ['principal', 'teacher', 'accountant', 'hr_manager', 'admissions_officer', 'librarian'] as const) {
      const l = labels(role);
      expect(l).toContain('Dashboard');
      expect(l).toContain('Messages');
      expect(l).toContain('My Profile');
    }
  });

  it('scopes the teacher to teaching work only', () => {
    const l = labels('teacher');
    expect(l).toEqual(
      expect.arrayContaining(['Attendance', 'Assessments', 'Homework', 'Report Cards', 'Timetable']),
    );
    for (const forbidden of [
      'Finance Overview',
      'Invoices',
      'Employees',
      'Users & Roles',
      'Applications',
      'Academic Years',
      'Grades',
      'Grading Scales',
      'Report Templates',
      'Reports',
      'Schools',
    ]) {
      expect(l).not.toContain(forbidden);
    }
  });

  it('keeps report-card configuration out of teacher and HOD navs, in the principal nav', () => {
    expect(labels('principal')).toEqual(expect.arrayContaining(['Grading Scales', 'Report Templates']));
    expect(labels('teacher')).not.toContain('Grading Scales');
    expect(labels('department_head')).not.toContain('Report Templates');
  });

  it('scopes finance roles to a finance workspace', () => {
    const l = labels('accountant');
    expect(l).toEqual(
      expect.arrayContaining(['Finance Overview', 'Invoices', 'Bank Reconciliation', 'Fee Structures']),
    );
    for (const forbidden of [
      'Attendance',
      'Assessments',
      'Homework',
      'Academic Years',
      'Classes',
      'Employees',
      'Applications',
      'Users & Roles',
      'Safeguarding',
    ]) {
      expect(l).not.toContain(forbidden);
    }
  });

  it('scopes HR to staff functions only', () => {
    const l = labels('hr_manager');
    expect(l).toEqual(expect.arrayContaining(['Employees', 'Departments', 'Staff Attendance', 'Leave Requests', 'Users & Roles']));
    for (const forbidden of ['Attendance', 'Assessments', 'Finance Overview', 'Applications', 'Grades', 'Learners']) {
      expect(l).not.toContain(forbidden);
    }
  });

  it('scopes admissions roles to admissions + directory work', () => {
    const l = labels('admissions_officer');
    expect(l).toContain('Applications');
    for (const forbidden of ['Attendance', 'Assessments', 'Finance Overview', 'Employees', 'Academic Years']) {
      expect(l).not.toContain(forbidden);
    }
  });

  it('gives a department head their real functions (report cards, learners) and nothing else', () => {
    const l = labels('department_head');
    expect(l).toEqual(expect.arrayContaining(['Report Cards', 'Learners']));
    for (const forbidden of [
      'Attendance',
      'Assessments',
      'Finance Overview',
      'Employees',
      'Users & Roles',
      'Applications',
      'Academic Years',
    ]) {
      expect(l).not.toContain(forbidden);
    }
  });

  it('restricts Users & Roles to profile.manage_any holders', () => {
    expect(labels('principal')).toContain('Users & Roles');
    expect(labels('hr_manager')).toContain('Users & Roles');
    for (const role of ['receptionist', 'admissions_officer', 'support_engineer', 'auditor'] as const) {
      expect(labels(role)).not.toContain('Users & Roles');
    }
  });

  it('gives a permissionless role a minimal honest nav', () => {
    const l = labels('librarian');
    expect(l.sort()).toEqual(
      ['Announcements', 'Dashboard', 'Messages', 'My Profile', 'Notification Preferences'].sort(),
    );
  });

  it('gives the principal whole-school navigation', () => {
    const l = labels('principal');
    expect(l).toEqual(
      expect.arrayContaining([
        'Learners',
        'Guardians',
        'Applications',
        'Academic Years',
        'Attendance',
        'Report Cards',
        'Employees',
        'Reports',
        'Users & Roles',
        'School Profile',
      ]),
    );
  });

  it('every item in the model has a real destination path', () => {
    for (const group of NAV_MODEL) {
      for (const item of group.items) {
        expect(item.path).toMatch(/^\//);
      }
    }
  });
});
