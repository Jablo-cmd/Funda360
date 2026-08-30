import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockLearnerRow,
  installDataMocks,
  installLearnersListMock,
} from './utils/mockData';

test('principal can view the alumni registry', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersListMock(page, [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube', status: 'graduated' }),
  ]);

  await page.goto('/alumni');
  await expect(page.getByRole('heading', { name: 'Alumni' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Naledi Dube' })).toBeVisible();
  await expect(page.getByText('graduated', { exact: true })).toBeVisible();
});

test('the alumni registry has no create/import actions', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersListMock(page, []);

  await page.goto('/alumni');
  await expect(page.getByRole('heading', { name: 'Alumni' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add learner' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import CSV' })).toHaveCount(0);
});

test('a role without learner.view is blocked from the alumni registry', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/alumni');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Alumni' })).toHaveCount(0);
});
