import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockProfileRow,
  buildMockSchoolRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockLearnerRow,
  buildMockAssessmentRow,
  installDataMocks,
  installAcademicListMock,
  installLearnersListMock,
  installEmployeesListMock,
  installUsersListMock,
  installReportRowsMock,
  installAttendanceRecordsMock,
  installAssessmentsListMock,
} from './utils/mockData';

/**
 * A practical accessibility baseline, not a full audit: automated
 * scanning (axe-core) only catches a subset of WCAG issues — missing
 * labels, contrast, landmark/role misuse, unlabelled form controls — and
 * says nothing about keyboard-flow sensibility or screen-reader phrasing.
 * Failing this means a genuine, tool-detectable defect; passing it is a
 * floor, not a certification. Scoped to the pages named in the audit
 * brief (Login, Dashboard, Attendance, Attendance Report, Learners,
 * Assessments) rather than every route in the app.
 */
/**
 * FND-SEC-007: `color-contrast`/`link-in-text-block` were previously
 * excluded here — the `content-tertiary` token measured ~2.56:1 against
 * white (light mode) and ~3.62:1 (dark mode), both under WCAG AA's 4.5:1
 * floor for normal text. The token itself has been fixed (see
 * src/styles/index.css) to 4.667:1 / 4.925:1 respectively, so the
 * exclusion is removed — every rule now gates for real, including
 * contrast, not just labels/ARIA/roles/landmarks/keyboard affordances.
 */
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length > 0) {
    console.log(JSON.stringify(serious, null, 2));
  }
  expect(serious, `${serious.length} serious/critical accessibility violation(s) found — see console output above for detail`).toEqual([]);
}

test('Login page has no serious/critical accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('Dashboard has no serious/critical accessibility violations', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAttendanceRecordsMock(page, []);
  await installLearnersListMock(page, []);
  await installEmployeesListMock(page, []);
  await installUsersListMock(page, [buildMockProfileRow()]);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('Attendance page has no serious/critical accessibility violations', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' })]);
  await installAttendanceRecordsMock(page, []);

  await page.goto('/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('Attendance Report page has no serious/critical accessibility violations', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAttendanceRecordsMock(page, []);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/reports/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance report' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('Learners page has no serious/critical accessibility violations', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersListMock(page, [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' })]);

  await page.goto('/learners');
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('Assessments page has no serious/critical accessibility violations', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', []);
  await installAssessmentsListMock(page, [buildMockAssessmentRow()]);

  await page.goto('/academic/assessments');
  await expect(page.getByRole('heading', { name: 'Assessments' })).toBeVisible();
  await expectNoSeriousViolations(page);
});
