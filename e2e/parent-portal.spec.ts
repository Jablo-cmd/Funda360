import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockLearnerRow,
  buildMockLearnerEnrollmentRow,
  buildMockGradeRow,
  buildMockClassRow,
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
