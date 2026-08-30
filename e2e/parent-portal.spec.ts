import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockLearnerRow,
  buildMockLearnerEnrollmentRow,
  buildMockGradeRow,
  buildMockClassRow,
  buildMockSubjectRow,
  buildMockTimetableEntryRow,
  buildMockLearnerMedicalInformationRow,
  buildMockLearnerEmergencyContactRow,
  installDataMocks,
  installReportRowsMock,
  installLearnerDetailMock,
  installLearnerChildListMock,
  installLearnerMedicalInformationMock,
  installAcademicListMock,
} from './utils/mockData';

/**
 * ChildCard/ChildOverviewTab call useChildContext() (enrollments + grades +
 * classes + class_teacher_assignments) unconditionally, and
 * LearnerSelfSummary calls medical-information/emergency-contacts hooks
 * unconditionally — every test below mocks all of these, same rationale as
 * my-profile.spec.ts's installMyProfileAcademicMocks.
 */
async function installChildContextMocks(page: Parameters<typeof installAcademicListMock>[0]) {
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow()]);
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
}

test('a guardian landing on /dashboard is redirected to the Parent Portal', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', []);
  await installChildContextMocks(page);

  await page.goto('/dashboard');
  await expect(page).toHaveURL('http://localhost:5173/parent/dashboard');
});

test('a non-guardian role cannot reach the Parent Portal directly', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'finance_manager' }), school: buildMockSchoolRow() });

  await page.goto('/parent/dashboard');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
});

test('a guardian linked to one learner sees them on the Parent dashboard', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' })]);
  await installChildContextMocks(page);

  await page.goto('/parent/dashboard');
  await expect(page.getByRole('heading', { name: 'My Children' })).toBeVisible();
  await expect(page.getByText('Naledi Dube')).toBeVisible();
  await expect(page.getByText('Grade 8 · Grade 8A')).toBeVisible();
});

test('a guardian linked to multiple learners sees all of them', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' }),
    buildMockLearnerRow({ id: 'learner-2', firstName: 'Thabo', lastName: 'Dube' }),
  ]);
  await installChildContextMocks(page);

  await page.goto('/parent/children');
  await expect(page.getByText('Naledi Dube')).toBeVisible();
  await expect(page.getByText('Thabo Dube')).toBeVisible();
});

test('a guardian linked to zero learners sees an empty state, not an error', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', []);
  await installChildContextMocks(page);

  await page.goto('/parent/dashboard');
  await expect(page.getByText(/No learners are linked to your account/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Children' })).toHaveCount(0);
});

test("a guardian sees their linked child's medical information on the child profile", async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }));
  await installChildContextMocks(page);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);
  await installLearnerMedicalInformationMock(
    page,
    buildMockLearnerMedicalInformationRow({ learnerId: 'learner-1', allergies: 'Peanuts' }),
  );

  await page.goto('/parent/children/learner-1');
  await expect(page.getByRole('heading', { name: 'Medical information' })).toBeVisible();
  await expect(page.getByText('Peanuts')).toBeVisible();
});

test('a guardian sees emergency contacts on the child profile', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }));
  await installChildContextMocks(page);
  await installLearnerMedicalInformationMock(page, null);
  await page.route('**/rest/v1/learner_emergency_contacts*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([buildMockLearnerEmergencyContactRow({ learnerId: 'learner-1', name: 'Zanele Dube' })]),
    });
  });

  await page.goto('/parent/children/learner-1');
  await expect(page.getByRole('heading', { name: 'Emergency Contacts' })).toBeVisible();
  await expect(page.getByText('Zanele Dube')).toBeVisible();
});

test('a guardian visiting a learner not linked to them sees a not-found state, not the learner', async ({ page }) => {
  // installLearnerDetailMock(page, null) simulates exactly what RLS
  // produces for an unlinked learner id — is_learner_guardian() filters the
  // row out, so the single-row fetch resolves to null, indistinguishable
  // from a nonexistent id. This is the real enforcement (see
  // ParentChildProfilePage's own comment); this test only proves the page
  // handles that null correctly rather than crashing or rendering blank.
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, null);

  await page.goto('/parent/children/not-my-learner');
  await expect(page.getByText(/isn't linked to your account/)).toBeVisible();
});

test('a guardian cannot reach a staff-only route', async ({ page }) => {
  // RequirePermission (profile.view_any, which ROLE_PERMISSIONS['guardian']
  // does not hold) first redirects to /dashboard — which, for a guardian,
  // is itself wrapped by RedirectGuardiansToParentPortal, so the chain ends
  // at /parent/dashboard, not /dashboard. Both redirects are real
  // navigations re-matched against the full route tree.
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', []);
  await installChildContextMocks(page);

  await page.goto('/users');
  await expect(page).toHaveURL('http://localhost:5173/parent/dashboard');
});

test("a guardian sees their child's weekly timetable on the child profile", async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'guardian' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }));
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow()]);
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installAcademicListMock(page, 'timetable_entries', [buildMockTimetableEntryRow()]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [{ id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' }]);
  });

  await page.goto('/parent/children/learner-1');
  await page.getByRole('button', { name: 'Timetable', exact: true }).click();

  const lessonChip = page.getByRole('button', { name: /Mathematics/ });
  await expect(lessonChip).toBeVisible();
  await expect(lessonChip).toContainText('Room 1');
  // No "manage" affordance — the guardian's grid is read-only.
  await expect(lessonChip).toBeDisabled();
});

test("a guardian sees their child's documents on the child profile", async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }));
  await installLearnerChildListMock(page, 'learner_documents', [
    {
      id: 'doc-1',
      school_id: MOCK_TENANT_ID,
      learner_id: 'learner-1',
      document_type: 'report_card',
      file_url: `${MOCK_TENANT_ID}/learner-1/report.pdf`,
      file_name: 'report.pdf',
      uploaded_at: '2026-02-01T00:00:00Z',
      notes: null,
      active: true,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    },
  ]);

  await page.goto('/parent/children/learner-1');
  await page.getByRole('button', { name: 'Documents', exact: true }).click();

  await expect(page.getByText('report.pdf')).toBeVisible();
  // Read-only — no archive/restore action column for a guardian.
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
});
