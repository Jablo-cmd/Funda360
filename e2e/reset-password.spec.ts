import { test, expect } from '@playwright/test';
import {
  buildMockSession,
  buildMockUser,
  fulfillAuthError,
  fulfillJson,
  installAuthMocks,
  seedAuthenticatedSession,
} from './utils/mockAuth';

test('shows an invalid-link notice when there is no recovery session', async ({ page }) => {
  await page.goto('/reset-password');

  await expect(page.getByRole('alert')).toHaveText(
    'This password reset link is invalid or has expired.',
  );
  await page.getByRole('link', { name: 'Request a new reset link' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test('validates password confirmation and updates the password', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installAuthMocks(page, {
    user: (route) => fulfillJson(route, { user: buildMockUser() }),
    logout: (route) => fulfillJson(route, {}, 204),
  });

  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();

  await page.locator('#new-password').fill('newsecurepass123');
  await page.locator('#confirm-new-password').fill('doesnotmatch');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Passwords do not match')).toBeVisible();

  await page.locator('#confirm-new-password').fill('newsecurepass123');
  await page.getByRole('button', { name: 'Update password' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toHaveText(
    'Your password has been updated. Please sign in.',
  );
});

test('a token-hash email link opened in a fresh browser signs in and opens the reset form', async ({
  page,
}) => {
  let verifyBody: unknown;
  await installAuthMocks(page, {
    verify: async (route) => {
      verifyBody = route.request().postDataJSON();
      await fulfillJson(route, buildMockSession());
    },
  });

  // The recovery email links to {{ .RedirectTo }}; when Supabase falls back
  // to the bare site URL, the app still lands on the reset form.
  await page.goto('/?token_hash=hash-from-email&type=recovery');

  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  expect(verifyBody).toMatchObject({ token_hash: 'hash-from-email', type: 'recovery' });
});

test('an expired token-hash email link shows the invalid-link notice', async ({ page }) => {
  await installAuthMocks(page, {
    verify: (route) =>
      fulfillAuthError(route, 'otp_expired', 'Email link is invalid or has expired', 403),
  });

  await page.goto('/reset-password?token_hash=used-hash&type=recovery');

  await expect(page.getByRole('alert')).toHaveText(
    'This password reset link is invalid or has expired.',
  );
  await expect(page).toHaveURL(/\/reset-password$/);
});
