import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

test('shows a friendly notice when the signed-in user has no profile row', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, { profile: null });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Profile not found' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText("couldn't find a profile");
});

test('shows a friendly notice when a non-platform role has no tenant assigned', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ tenantId: null, firstName: 'Naledi', lastName: 'Dlamini' }),
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'No school assigned' })).toBeVisible();
});

test('shows a friendly notice when the assigned school is inactive', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow({ status: 'inactive' }),
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'School inactive' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Riverside Secondary School');
});

test('a platform-level role with no tenant reaches the protected home directly', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'super_administrator' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ tenantId: null, firstName: 'Lerato', lastName: 'Molefe' }),
  });

  await page.goto('/');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back, Lerato' })).toBeVisible();
  // Scoped to main: the sidebar's account identity block also renders the
  // role text ("super administrator"), so an unscoped query is ambiguous.
  await expect(page.getByRole('main').getByText('super administrator', { exact: true })).toBeVisible();
});
