import { test, expect } from '@playwright/test';
import { buildMockUser, fulfillJson, installAuthMocks, seedAuthenticatedSession } from './utils/mockAuth';
import { installGuardianInvitationRpcMock } from './utils/mockData';

test('shows an invalid-invitation notice when there is no recovery session', async ({ page }) => {
  await page.goto('/activate-account');

  await expect(page.getByRole('alert')).toHaveText('This invitation link is invalid or has expired.');
  await page.getByRole('link', { name: 'Go to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('a guardian with a pending invitation sees their linked children and can activate their account', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installAuthMocks(page, {
    user: (route) => fulfillJson(route, { user: buildMockUser({ role: 'guardian' }) }),
    logout: (route) => fulfillJson(route, {}, 204),
  });
  await installGuardianInvitationRpcMock(page, 'get_my_guardian_invitation', (route) =>
    fulfillJson(route, {
      guardianFirstName: 'John',
      guardianLastName: 'Smith',
      schoolName: 'Riverside Secondary School',
      invitation: {
        id: 'invitation-1',
        status: 'pending',
        effectiveStatus: 'pending',
        expiresAt: '2026-08-30T00:00:00Z',
        acceptedAt: null,
      },
      children: [{ id: 'learner-1', firstName: 'Maria', lastName: 'Johnson' }],
    }),
  );
  await installGuardianInvitationRpcMock(page, 'accept_guardian_invitation', (route) =>
    fulfillJson(route, {
      id: 'invitation-1',
      status: 'accepted',
      accepted_at: '2026-08-24T00:00:00Z',
    }),
  );

  await page.goto('/activate-account');

  await expect(page.getByText('Welcome, John.')).toBeVisible();
  await expect(page.getByText('Riverside Secondary School has invited you')).toBeVisible();
  await expect(page.getByText('Maria Johnson')).toBeVisible();

  await page.locator('#new-password').fill('newsecurepass123');
  await page.locator('#confirm-new-password').fill('newsecurepass123');
  await page.getByRole('button', { name: 'Activate my account' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('status')).toHaveText('Your account is now active. Please sign in.');
});

test('a revoked invitation blocks activation with a clear message and no password form', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installAuthMocks(page, { user: (route) => fulfillJson(route, { user: buildMockUser({ role: 'guardian' }) }) });
  await installGuardianInvitationRpcMock(page, 'get_my_guardian_invitation', (route) =>
    fulfillJson(route, {
      guardianFirstName: 'John',
      guardianLastName: 'Smith',
      schoolName: 'Riverside Secondary School',
      invitation: {
        id: 'invitation-1',
        status: 'revoked',
        effectiveStatus: 'revoked',
        expiresAt: '2026-08-23T00:00:00Z',
        acceptedAt: null,
      },
      children: [],
    }),
  );

  await page.goto('/activate-account');

  await expect(page.getByRole('alert')).toHaveText(
    'This invitation has been revoked by your school. Please contact them for a new one.',
  );
  await expect(page.locator('#new-password')).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
