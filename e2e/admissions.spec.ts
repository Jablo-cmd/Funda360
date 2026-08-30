import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockLearnerRow,
  installDataMocks,
  installAdmissionsPipelineMock,
  installLearnerRpcMock,
} from './utils/mockData';

test('principal sees applicants grouped by admissions stage', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installAdmissionsPipelineMock(page, [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube', status: 'prospective' }),
    buildMockLearnerRow({ id: 'learner-2', firstName: 'Sipho', lastName: 'Khumalo', status: 'applied' }),
  ]);

  await page.goto('/admissions');
  await expect(page.getByRole('heading', { name: 'Admissions Pipeline' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Naledi Dube' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sipho Khumalo' })).toBeVisible();
});

test('principal can advance an applicant to the next admissions stage', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installAdmissionsPipelineMock(page, [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube', status: 'prospective' }),
  ]);
  let rpcCalled = false;
  await installLearnerRpcMock(page, 'change_learner_status', async (route) => {
    rpcCalled = true;
    await fulfillJson(route, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube', status: 'applied' }));
  });

  await page.goto('/admissions');
  await page.getByRole('button', { name: 'Applied →' }).click();

  await expect.poll(() => rpcCalled).toBe(true);
});

test('a role without learner.view is blocked from the admissions pipeline', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/admissions');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Admissions' })).toHaveCount(0);
});
