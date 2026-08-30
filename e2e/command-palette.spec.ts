import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, installDataMocks } from './utils/mockData';

test('a manager can open the command palette with Ctrl+K and jump to a learner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [
      { id: 'learner-42', first_name: 'Naledi', last_name: 'Dube', learner_number: 'LRN-0042', admission_number: 'ADM-0042' },
    ]);
  });
  await page.route('**/rest/v1/employees*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('or')) return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();

  await page.getByRole('combobox', { name: /search learners/i }).fill('Naledi');
  await expect(page.getByRole('option', { name: /Naledi Dube/ })).toBeVisible();
  await page.getByRole('option', { name: /Naledi Dube/ }).click();

  await expect(page).toHaveURL(/\/learners\/learner-42/);
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
});

test('the search button in the header also opens the command palette', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
});

test('a role with no learner/employee/guardian view permission sees no search trigger', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'librarian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'librarian' }), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Search' })).toHaveCount(0);

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
});
