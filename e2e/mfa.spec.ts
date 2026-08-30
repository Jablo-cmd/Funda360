import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  installDataMocks,
  installEmployeeDetailMock,
  installReportRowsMock,
  installAcademicListMock,
} from './utils/mockData';

const VERIFIED_TOTP_FACTOR = { id: 'factor-1', factor_type: 'totp' as const, status: 'verified' as const };

/** Mirrors installMyProfileAcademicMocks from my-profile.spec.ts — MyProfilePage calls these unconditionally regardless of role. */
async function installMyProfileMocks(page: Parameters<typeof installAcademicListMock>[0]) {
  await installEmployeeDetailMock(page, null);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installAcademicListMock(page, 'classes', []);
  await installAcademicListMock(page, 'subjects', []);
  await installReportRowsMock(page, 'learners', []);
}

test('a qualifying role with no MFA enrolled sees the required banner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'finance_manager' }), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await expect(page.getByText('Your role requires two-factor authentication.')).toBeVisible();
  await page.getByRole('link', { name: 'Set up now' }).click();
  await expect(page).toHaveURL(/\/my-profile#mfa-security$/);
});

test('a non-qualifying role never sees the required banner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await expect(page.getByText('Your role requires two-factor authentication.')).toHaveCount(0);
});

test('a qualifying role with a verified factor already on the session does not see the banner', async ({ page }) => {
  // Simulates "already enrolled" without exercising the real enroll/verify
  // network flow (covered live against real Supabase Auth instead — see
  // FND-ARCH-003's Kanban entry) — just seeds the session's own
  // user.factors, exactly what mfaService.listFactors()/getAssuranceLevel()
  // actually read.
  await seedAuthenticatedSession(page, { role: 'school_owner', factors: [VERIFIED_TOTP_FACTOR] });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'school_owner' }), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await expect(page.getByText('Your role requires two-factor authentication.')).toHaveCount(0);
});

test('My Profile shows the Two-Factor Authentication section for every role', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });
  await installMyProfileMocks(page);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set up two-factor authentication' })).toBeVisible();
});

test('My Profile shows the Enabled state and a Remove option when a verified factor is already on the session', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'school_owner', factors: [VERIFIED_TOTP_FACTOR] });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'school_owner' }), school: buildMockSchoolRow() });
  await installMyProfileMocks(page);

  await page.goto('/my-profile');
  await expect(page.getByText('Enabled', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove two-factor authentication' })).toBeVisible();
});
