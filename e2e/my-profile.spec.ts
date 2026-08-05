import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockEmployeeRow,
  buildMockLearnerRow,
  buildMockLearnerMedicalInformationRow,
  buildMockLearnerEmergencyContactRow,
  installDataMocks,
  installEmployeeDetailMock,
  installReportRowsMock,
  installLearnerMedicalInformationMock,
  installLearnerChildListMock,
} from './utils/mockData';

test('an employee-linked account sees the Employee Information section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, buildMockEmployeeRow());
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();
  await expect(page.getByText('Karabo Mokoena')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Children' })).toHaveCount(0);
});

test('a guardian linked to exactly one learner sees My Children with one entry', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' })]);
  await installLearnerMedicalInformationMock(page, null);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'My Children' })).toBeVisible();
  await expect(page.getByText('Naledi')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toHaveCount(0);
});

test('a guardian sees their linked child\'s medical information when a record exists', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' })]);
  await installLearnerMedicalInformationMock(
    page,
    buildMockLearnerMedicalInformationRow({ learnerId: 'learner-1', allergies: 'Peanuts' }),
  );
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'Medical information' })).toBeVisible();
  await expect(page.getByText('Peanuts')).toBeVisible();
});

test('a guardian\'s linked child with no medical record shows no Medical information section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' })]);
  await installLearnerMedicalInformationMock(page, null);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.goto('/my-profile');
  await expect(page.getByText('Naledi')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Medical information' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a guardian sees emergency contacts for a linked learner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' })]);
  await installLearnerMedicalInformationMock(page, null);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', [
    buildMockLearnerEmergencyContactRow({ learnerId: 'learner-1', name: 'Zanele Dube' }),
  ]);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'Emergency Contacts' })).toBeVisible();
  await expect(page.getByText('Zanele Dube')).toBeVisible();
});

test('a guardian with no emergency contacts sees no emergency-contact section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' })]);
  await installLearnerMedicalInformationMock(page, null);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.goto('/my-profile');
  await expect(page.getByText('Naledi')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Emergency Contacts' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a guardian linked to more than one learner sees all of them', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' }),
    buildMockLearnerRow({ id: 'learner-2', firstName: 'Thabo', lastName: 'Dube' }),
  ]);
  await installLearnerMedicalInformationMock(page, null);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.goto('/my-profile');
  await expect(page.getByText('Naledi Dube')).toBeVisible();
  await expect(page.getByText('Thabo Dube')).toBeVisible();
});

test('a guardian linked to zero learners sees the empty state, not an error', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page.getByText("There's nothing linked to your account yet.")).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Children' })).toHaveCount(0);
});

test('a user with neither an employee nor a guardian linkage sees the empty state', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'finance_manager' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page.getByText("There's nothing linked to your account yet.")).toBeVisible();
});

test('any authenticated role can reach /my-profile without a permission redirect', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'auditor' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'auditor' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page).toHaveURL('http://localhost:5173/my-profile');
});
