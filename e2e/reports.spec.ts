import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockLearnerRow,
  buildMockEmployeeRow,
  buildMockDepartmentRow,
  buildMockAcademicYearRow,
  buildMockGradeRow,
  buildMockClassRow,
  buildMockSubjectRow,
  buildMockTermRow,
  installDataMocks,
  installDepartmentsListMock,
  installAcademicListMock,
  installReportRowsMock,
} from './utils/mockData';

test('reports overview loads and links to each report a principal can view', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.goto('/reports');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Learners' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Employees' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Academic' })).toBeVisible();
});

test('learner report renders enrollment counts by status', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', [
    buildMockLearnerRow({ id: 'learner-1', status: 'active' }),
    buildMockLearnerRow({ id: 'learner-2', status: 'active' }),
    buildMockLearnerRow({ id: 'learner-3', status: 'graduated' }),
  ]);

  await page.goto('/reports/learners');
  await expect(page.getByRole('heading', { name: 'Learner report' })).toBeVisible();
  await expect(page.getByText('Total learners')).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await expect(page.getByText('active', { exact: true })).toBeVisible();
  await expect(page.getByText('graduated', { exact: true })).toBeVisible();
});

test('employee report renders counts by department and employment status', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installReportRowsMock(page, 'employees', [
    buildMockEmployeeRow({ id: 'employee-1', employmentStatus: 'active' }),
    buildMockEmployeeRow({ id: 'employee-2', employmentStatus: 'on_leave' }),
  ]);

  await page.goto('/reports/employees');
  await expect(page.getByRole('heading', { name: 'Employee report' })).toBeVisible();
  await expect(page.getByText('Total employees')).toBeVisible();
  await expect(page.getByText('Human Resources')).toBeVisible();
  await expect(page.getByText('on leave')).toBeVisible();
});

test('academic report renders active vs. archived counts', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ isActive: true })],
  });
  await installAcademicListMock(page, 'grades', [
    buildMockGradeRow({ id: 'grade-8', active: true }),
    buildMockGradeRow({ id: 'grade-9', active: false }),
  ]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'terms', [buildMockTermRow()]);

  await page.goto('/reports/academic');
  await expect(page.getByRole('heading', { name: 'Academic report' })).toBeVisible();
  await expect(page.getByText('2026 Academic Year')).toBeVisible();
  await expect(page.getByText('Grades', { exact: true })).toBeVisible();
});

test('reports.view is required to access any report route', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'finance_manager' }), school: buildMockSchoolRow() });

  await page.goto('/reports');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
});

test('a role with reports.view but without employee.view cannot view the Employee report', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'admissions_officer' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'admissions_officer' }),
    school: buildMockSchoolRow(),
  });

  await page.goto('/reports/employees');
  await expect(page.getByText("You don't have permission to view this report.")).toBeVisible();
  await expect(page.getByText('Total employees')).toHaveCount(0);
});

test('export button is hidden for a role without reports.export', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ isActive: true })],
  });
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'terms', [buildMockTermRow()]);

  await page.goto('/reports/academic');
  await expect(page.getByRole('heading', { name: 'Academic report' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);
});

test('export button is visible for a role with reports.export', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ isActive: true })],
  });
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'terms', [buildMockTermRow()]);

  await page.goto('/reports/academic');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
});
