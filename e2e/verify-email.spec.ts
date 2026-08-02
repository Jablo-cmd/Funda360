import { test, expect } from '@playwright/test';
import { fulfillJson, installAuthMocks, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

test('redirects an unverified signed-in user to /verify-email and allows resending', async ({ page }) => {
  await seedAuthenticatedSession(page, { emailConfirmed: false });
  await installAuthMocks(page, {
    resend: (route) => fulfillJson(route, {}),
  });

  await page.goto('/');
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await expect(page.getByText('admin@funda360.com')).toBeVisible();

  await page.getByRole('button', { name: 'Resend verification email' }).click();
  await expect(page.getByRole('status')).toHaveText('Verification email sent. Please check your inbox.');
  await expect(page.getByRole('button', { name: /Resend available in \d+s/ })).toBeVisible();
});

test('sends a verified signed-in user straight to the protected home', async ({ page }) => {
  await seedAuthenticatedSession(page, { emailConfirmed: true });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
  });

  await page.goto('/verify-email');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome back, Ada' })).toBeVisible();
});
