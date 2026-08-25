import { test, expect } from '@playwright/test';
import { MOCK_USER_ID, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockClassTeacherAssignmentRow,
  buildMockLearnerRow,
  buildMockLearnerEnrollmentRow,
  buildMockAssessmentRow,
  buildMockAssessmentResultRow,
  installDataMocks,
  installAcademicListMock,
  installLearnerChildListMock,
  installLearnerDetailMock,
  installLearnerMedicalInformationMock,
  installEmployeeDetailMock,
  installReportRowsMock,
  installAssessmentsListMock,
  installAssessmentDetailMock,
  installAssessmentsByIdsMock,
  installAssessmentResultsMock,
  installAssessmentResultsUpsertMock,
} from './utils/mockData';

test('a teacher can enter marks for their class and save them', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', []);
  await installAcademicListMock(page, 'terms', [
    { id: 'term-1', academic_year_id: 'year-2026', school_id: 'tenant-demo', name: 'Term 1', sequence: 1, start_date: '2026-01-15', end_date: '2026-04-01', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ]);
  await installAcademicListMock(page, 'class_teacher_assignments', [
    buildMockClassTeacherAssignmentRow({ teacherProfileId: MOCK_USER_ID }),
  ]);
  await installAssessmentDetailMock(page, buildMockAssessmentRow());
  await installLearnerChildListMock(page, 'learner_enrollments', [
    buildMockLearnerEnrollmentRow({ learnerId: 'learner-1' }),
    buildMockLearnerEnrollmentRow({ id: 'enrollment-2', learnerId: 'learner-2' }),
  ]);
  await installReportRowsMock(page, 'learners', [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' }),
    buildMockLearnerRow({ id: 'learner-2', firstName: 'Sipho', lastName: 'Khumalo' }),
  ]);
  await installAssessmentResultsMock(page, []);
  await installAssessmentResultsUpsertMock(page, [
    buildMockAssessmentResultRow({ learnerId: 'learner-1', mark: 42 }),
    buildMockAssessmentResultRow({ id: 'result-2', learnerId: 'learner-2', mark: 37 }),
  ]);

  await page.goto('/academic/assessments/assessment-1');
  // The mark-entry grid renders both a desktop table and a mobile card list
  // (only one is visually shown at a given viewport, via CSS) — scoped to
  // the table specifically avoids the resulting duplicate-match ambiguity.
  const table = page.getByRole('table');
  await expect(page.getByRole('heading', { name: 'Test 1' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Naledi Dube', exact: true })).toBeVisible();

  await table.getByLabel('Mark for Naledi Dube').fill('42');
  await table.getByLabel('Mark for Sipho Khumalo').fill('37');
  await page.getByRole('button', { name: 'Save marks' }).click();

  await expect(page.getByText('Marks saved.')).toBeVisible();
  await expect(table.getByLabel('Mark for Naledi Dube')).toHaveValue('42');
  await expect(table.getByText('84%')).toBeVisible();
});

test('a teacher can correct a previously entered mark', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', []);
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'class_teacher_assignments', [
    buildMockClassTeacherAssignmentRow({ teacherProfileId: MOCK_USER_ID }),
  ]);
  await installAssessmentDetailMock(page, buildMockAssessmentRow());
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow({ learnerId: 'learner-1' })]);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' })]);
  await installAssessmentResultsMock(page, [buildMockAssessmentResultRow({ learnerId: 'learner-1', mark: 30 })]);
  await installAssessmentResultsUpsertMock(page, [buildMockAssessmentResultRow({ learnerId: 'learner-1', mark: 45 })]);

  await page.goto('/academic/assessments/assessment-1');
  const table = page.getByRole('table');
  await expect(table.getByLabel('Mark for Naledi Dube')).toHaveValue('30');

  await table.getByLabel('Mark for Naledi Dube').fill('45');
  await page.getByRole('button', { name: 'Save marks' }).click();

  await expect(page.getByText('Marks saved.')).toBeVisible();
  await expect(table.getByLabel('Mark for Naledi Dube')).toHaveValue('45');
});

test('an unassigned teacher sees a read-only register for a class they do not teach', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', []);
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installAssessmentDetailMock(page, buildMockAssessmentRow());
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow({ learnerId: 'learner-1' })]);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' })]);
  await installAssessmentResultsMock(page, [buildMockAssessmentResultRow({ learnerId: 'learner-1', mark: 30 })]);

  await page.goto('/academic/assessments/assessment-1');
  const table = page.getByRole('table');
  await expect(table.getByRole('cell', { name: 'Naledi Dube', exact: true })).toBeVisible();
  await expect(table.getByLabel('Mark for Naledi Dube')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save marks' })).toHaveCount(0);
});

test('a role without assessment.view is blocked from the assessments area', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });

  await page.goto('/academic/assessments');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Assessments' })).toHaveCount(0);
});

test('My Classes links to the assessments for an assigned class', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', []);
  await installAcademicListMock(page, 'class_teacher_assignments', [
    buildMockClassTeacherAssignmentRow({ teacherProfileId: MOCK_USER_ID }),
  ]);
  await installLearnerDetailMock(page, null);
  await installReportRowsMock(page, 'learners', []);
  // MyProfilePage also calls useMyEmployee() unconditionally regardless of
  // role — every other spec that visits /my-profile mocks this
  // (my-profile.spec.ts, teaching-assignments.spec.ts's own My Profile
  // test); this one didn't, so the request fell through installDataMocks'
  // catch-all route.continue() and reached a real local Supabase instance
  // (Docker, port 54321) with a fabricated session token instead of a
  // Playwright-mocked response. That real, variable-latency round trip —
  // not app or Vite behavior — was the actual cause of this test's
  // intermittent failure under parallel load (see investigation report).
  await installEmployeeDetailMock(page, null);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'My Classes' })).toBeVisible();
  const link = page.getByRole('link', { name: 'View assessments →' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/academic/assessments?classId=class-8a');
});

test("a learner's academic results appear on their profile", async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'subjects', [
    { id: 'subject-math', school_id: 'tenant-demo', name: 'Mathematics', code: 'MATH', description: null, active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ]);
  await installAcademicListMock(page, 'terms', [
    { id: 'term-1', academic_year_id: 'year-2026', school_id: 'tenant-demo', name: 'Term 1', sequence: 1, start_date: '2026-01-15', end_date: '2026-04-01', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ]);
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' }));
  await installLearnerChildListMock(page, 'learner_enrollments', []);
  await installLearnerChildListMock(page, 'learner_guardians', []);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);
  await installLearnerChildListMock(page, 'learner_documents', []);
  await installLearnerMedicalInformationMock(page, null);
  await installAssessmentResultsMock(page, [buildMockAssessmentResultRow({ learnerId: 'learner-1', mark: 42 })]);
  await installAssessmentsByIdsMock(page, [buildMockAssessmentRow()]);

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Academic results' }).click();

  await expect(page.getByText('Mathematics')).toBeVisible();
  await expect(page.getByText('42/50')).toBeVisible();
  await expect(page.getByText('84%')).toBeVisible();
});

test('an administrator can view the assessment report', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [
    { id: 'subject-math', school_id: 'tenant-demo', name: 'Mathematics', code: 'MATH', description: null, active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  ]);
  await installAcademicListMock(page, 'terms', []);
  await installAssessmentsListMock(page, [buildMockAssessmentRow()]);
  await installAssessmentResultsMock(page, [
    buildMockAssessmentResultRow({ learnerId: 'learner-1', mark: 42 }),
    buildMockAssessmentResultRow({ id: 'result-2', learnerId: 'learner-2', mark: 37 }),
  ]);
  await page.route('**/rest/v1/learners*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'learner-1', first_name: 'Naledi', last_name: 'Dube' },
        { id: 'learner-2', first_name: 'Sipho', last_name: 'Khumalo' },
      ]),
    });
  });

  await page.goto('/reports/assessments');
  await expect(page.getByRole('heading', { name: 'Assessment report' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Class performance summary' })).toBeVisible();
  await expect(page.getByText('Naledi Dube')).toBeVisible();
  await expect(page.getByText('Sipho Khumalo')).toBeVisible();
});
