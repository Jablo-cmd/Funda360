import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockGradeRow,
  buildMockClassRow,
  buildMockLearnerRow,
  buildMockLearnerEnrollmentRow,
  buildMockLearnerEmergencyContactRow,
  buildMockLearnerMedicalInformationRow,
  installDataMocks,
  installAcademicListMock,
  installLearnersListMock,
  installLearnerDetailMock,
  installLearnerChildListMock,
  installLearnerMedicalInformationMock,
  installLearnerRpcMock,
} from './utils/mockData';

test('principal can view the learners directory', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersListMock(page, [buildMockLearnerRow()]);

  await page.goto('/learners');
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Naledi Dube' })).toBeVisible();
});

test('principal can create a learner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersListMock(page, []);

  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockLearnerRow({ id: 'learner-2', firstName: 'Sipho', lastName: 'Khumalo' }));
  });

  await page.goto('/learners');
  await page.getByRole('button', { name: 'Add learner' }).click();
  await page.getByLabel('First name').fill('Sipho');
  await page.getByLabel('Last name').fill('Khumalo');
  await page.getByLabel('Learner number').fill('LRN-0002');
  await page.getByLabel('Admission number').fill('ADM-0002');
  await page.getByLabel('Date of birth').fill('2013-05-01');
  await page.getByLabel('Admission date').fill('2026-01-15');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add learner' })).toHaveCount(0);
});

test('principal can view a learner profile with full detail', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ idNumber: '0203145009087' }));

  await page.goto('/learners/learner-1');
  await expect(page.getByRole('heading', { name: 'Naledi Dube' })).toBeVisible();
  await expect(page.getByText('0203145009087')).toBeVisible();
});

test('medical_officer sees a masked ID number but retains medical access', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'medical_officer' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'medical_officer' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ idNumber: '0203145009087' }));
  await installLearnerMedicalInformationMock(page, buildMockLearnerMedicalInformationRow());

  await page.goto('/learners/learner-1');
  await expect(page.getByText('••••••••••••').first()).toBeVisible();
  await expect(page.getByText('0203145009087')).toHaveCount(0);

  await page.getByRole('button', { name: 'Medical' }).click();
  await expect(page.getByLabel('Allergies')).toBeVisible();
});

test('admissions_officer cannot view medical information', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'admissions_officer' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'admissions_officer' }),
    school: buildMockSchoolRow(),
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Medical' }).click();
  await expect(page.getByText("don't have permission to view medical information")).toBeVisible();
  await expect(page.getByLabel('Allergies')).toHaveCount(0);
});

test('principal can change a learner status', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerRpcMock(page, 'change_learner_status', async (route) => {
    await fulfillJson(route, buildMockLearnerRow({ status: 'suspended' }));
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Change status' }).click();
  await page.getByLabel('New status').selectOption('suspended');
  await page.getByRole('dialog').getByRole('button', { name: 'Change status' }).click();

  await expect(page.getByRole('heading', { name: 'Change learner status' })).toHaveCount(0);
});

test('principal can add an enrollment and promote a learner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow()]);

  await page.route('**/rest/v1/learner_enrollments*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockLearnerEnrollmentRow({ id: 'enrollment-2' }));
  });
  await installLearnerRpcMock(page, 'promote_learner', async (route) => {
    await fulfillJson(route, buildMockLearnerEnrollmentRow({ id: 'enrollment-3', enrollmentStatus: 'promoted' }));
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Enrollment' }).click();
  await expect(page.getByText('2026 Academic Year')).toBeVisible();

  await page.getByRole('button', { name: 'Add enrollment' }).click();
  await page.getByLabel('Enrollment date').fill('2026-01-20');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Add enrollment' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Promote' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Promote' }).click();
  await expect(page.getByRole('heading', { name: 'Promote learner' })).toHaveCount(0);
});

test('principal can add an emergency contact', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.route('**/rest/v1/learner_emergency_contacts*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockLearnerEmergencyContactRow());
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Emergency contacts' }).click();
  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.getByLabel('Name').fill('Zanele Dube');
  await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('+27 82 555 0101');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add emergency contact' })).toHaveCount(0);
});

test('a role without learner.view is blocked from the learners section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/learners');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Learners' })).toHaveCount(0);
});

test('tenant isolation: the learners list only ever reflects the caller\'s own tenant scope', async ({ page }) => {
  // As with the equivalent Users/Academic directory tests, RLS (verified
  // independently in supabase/rls-tests/tests/learner_management.test.sql)
  // is the actual tenant-isolation boundary — this only demonstrates that
  // the client renders exactly the rows its (tenant-scoped) query returns.
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersListMock(page, [buildMockLearnerRow({ schoolId: 'tenant-demo' })]);

  await page.goto('/learners');
  await expect(page.getByRole('link', { name: 'Naledi Dube' })).toBeVisible();
  await expect(page.getByText(/other-school/)).toHaveCount(0);
});
