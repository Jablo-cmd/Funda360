import { test, expect } from '@playwright/test';
import { fulfillJson, installAuthMocks, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockProfileRow,
  buildMockSchoolRow,
  buildMockLearnerRow,
  buildMockLearnerGuardianRow,
  buildMockGuardianInvitationRow,
  installDataMocks,
  installReportRowsMock,
  installLearnerChildListMock,
  installGuardianProfileDetailsMock,
  installGuardianInvitationRpcMock,
} from './utils/mockData';

const GUARDIAN_ID = 'guardian-profile-1';

async function installGuardianProfileMocks(page: Parameters<typeof installDataMocks>[0]) {
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('id') !== `eq.${GUARDIAN_ID}`) return route.fallback();
    await fulfillJson(
      route,
      buildMockProfileRow({ id: GUARDIAN_ID, firstName: 'John', lastName: 'Smith', email: 'john@example.com', role: 'guardian' }),
    );
  });
  await installLearnerChildListMock(page, 'learner_guardians', [
    buildMockLearnerGuardianRow({ id: 'link-1', guardianProfileId: GUARDIAN_ID, learnerId: 'learner-1' }),
  ]);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Maria', lastName: 'Johnson' })]);
  await installGuardianProfileDetailsMock(page, []);
}

test('a school_owner sees "Not invited" and can send an invitation, which then shows as pending', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'school_owner' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'school_owner' }), school: buildMockSchoolRow() });
  await installGuardianProfileMocks(page);
  await installAuthMocks(page, { recover: (route) => fulfillJson(route, {}) });

  let invitations: ReturnType<typeof buildMockGuardianInvitationRow>[] = [];
  await page.route('**/rest/v1/guardian_invitations*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, invitations);
  });
  await installGuardianInvitationRpcMock(page, 'send_guardian_invitation', async (route) => {
    const created = buildMockGuardianInvitationRow({ id: 'invitation-1', guardianProfileId: GUARDIAN_ID, status: 'pending' });
    invitations = [created];
    await fulfillJson(route, created);
  });

  await page.goto(`/guardians/${GUARDIAN_ID}`);
  await expect(page.getByRole('heading', { name: 'John Smith' })).toBeVisible();
  await expect(page.getByText('Not invited')).toBeVisible();

  await page.getByRole('button', { name: 'Send invitation' }).click();

  await expect(page.getByText('Invitation pending')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resend invitation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke invitation' })).toBeVisible();
});

test('a school_owner can revoke a pending invitation', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'school_owner' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'school_owner' }), school: buildMockSchoolRow() });
  await installGuardianProfileMocks(page);

  let invitations: ReturnType<typeof buildMockGuardianInvitationRow>[] = [
    buildMockGuardianInvitationRow({ id: 'invitation-1', guardianProfileId: GUARDIAN_ID, status: 'pending' }),
  ];
  await page.route('**/rest/v1/guardian_invitations*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, invitations);
  });
  await installGuardianInvitationRpcMock(page, 'revoke_guardian_invitation', async (route) => {
    const revoked = buildMockGuardianInvitationRow({
      id: 'invitation-1',
      guardianProfileId: GUARDIAN_ID,
      status: 'revoked',
      revokedAt: '2026-08-24T00:00:00Z',
    });
    invitations = [revoked];
    await fulfillJson(route, revoked);
  });

  await page.goto(`/guardians/${GUARDIAN_ID}`);
  await expect(page.getByText('Invitation pending')).toBeVisible();

  await page.getByRole('button', { name: 'Revoke invitation' }).click();
  await expect(page.getByRole('heading', { name: 'Revoke invitation' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoke', exact: true }).click();

  await expect(page.getByText('Invitation revoked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send invitation' })).toBeVisible();
});

test('an already-activated guardian shows no send/revoke actions', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'school_owner' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'school_owner' }), school: buildMockSchoolRow() });
  await installGuardianProfileMocks(page);
  await page.route('**/rest/v1/guardian_invitations*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [
      buildMockGuardianInvitationRow({
        id: 'invitation-1',
        guardianProfileId: GUARDIAN_ID,
        status: 'accepted',
        acceptedAt: '2026-08-22T00:00:00Z',
      }),
    ]);
  });

  await page.goto(`/guardians/${GUARDIAN_ID}`);
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /invitation/i })).toHaveCount(0);
});
