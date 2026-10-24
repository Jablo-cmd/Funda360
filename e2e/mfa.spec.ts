import { test, expect } from '@playwright/test';
import {
  buildMockUser,
  fulfillAuthError,
  fulfillJson,
  seedAuthenticatedSession,
} from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  installDataMocks,
  installEmployeeDetailMock,
  installReportRowsMock,
  installAcademicListMock,
} from './utils/mockData';

const VERIFIED_TOTP_FACTOR = {
  id: 'factor-1',
  factor_type: 'totp' as const,
  status: 'verified' as const,
};

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
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
  });

  await page.goto('/dashboard');
  await expect(page.getByText('Your role requires two-factor authentication.')).toBeVisible();
  await page.getByRole('link', { name: 'Set up now' }).click();
  await expect(page).toHaveURL(/\/my-profile#mfa-security$/);
});

test('a non-qualifying role never sees the required banner', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
  });

  await page.goto('/dashboard');
  await expect(page.getByText('Your role requires two-factor authentication.')).toHaveCount(0);
});

test('a qualifying role with a verified factor already on the session does not see the banner', async ({
  page,
}) => {
  // Simulates "already enrolled" without exercising the real enroll/verify
  // network flow (covered live against real Supabase Auth instead — see
  // FND-ARCH-003's Kanban entry) — just seeds the session's own
  // user.factors, exactly what mfaService.listFactors()/getAssuranceLevel()
  // actually read.
  await seedAuthenticatedSession(page, { role: 'school_owner', factors: [VERIFIED_TOTP_FACTOR] });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'school_owner' }),
    school: buildMockSchoolRow(),
  });

  await page.goto('/dashboard');
  await expect(page.getByText('Your role requires two-factor authentication.')).toHaveCount(0);
});

test('My Profile shows the Two-Factor Authentication section for every role', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
  });
  await installMyProfileMocks(page);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Set up two-factor authentication' }),
  ).toBeVisible();
});

test('My Profile shows the Enabled state and a Remove option when a verified factor is already on the session', async ({
  page,
}) => {
  await seedAuthenticatedSession(page, { role: 'school_owner', factors: [VERIFIED_TOTP_FACTOR] });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'school_owner' }),
    school: buildMockSchoolRow(),
  });
  await installMyProfileMocks(page);

  await page.goto('/my-profile');
  await expect(page.getByText('Enabled', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove two-factor authentication' }),
  ).toBeVisible();
});

test('setup still works after an abandoned attempt left an unverified factor behind', async ({
  page,
}) => {
  // Production, 2026-10-24: a first "Set up" left an unverified factor, and
  // every retry failed with mfa_factor_name_conflict because each enroll
  // sent the same (empty) friendly name. This GoTrue mock enforces that
  // rule, so the test fails unless startEnrollment() clears the leftover
  // factor and names the new one.
  let factors: Array<{
    id: string;
    factor_type: 'totp';
    status: 'verified' | 'unverified';
    friendly_name: string;
  }> = [{ id: 'stale-factor', factor_type: 'totp', status: 'unverified', friendly_name: '' }];
  const deleted: string[] = [];

  await seedAuthenticatedSession(page, { role: 'school_owner', factors });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'school_owner' }),
    school: buildMockSchoolRow(),
  });
  await installMyProfileMocks(page);
  await page.route('**/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname.endsWith('/user') && method === 'GET') {
      return fulfillJson(route, { ...buildMockUser({ role: 'school_owner' }), factors });
    }
    const factorMatch = /\/factors\/([^/]+)$/.exec(url.pathname);
    if (factorMatch && method === 'DELETE') {
      deleted.push(factorMatch[1]!);
      factors = factors.filter((factor) => factor.id !== factorMatch[1]);
      return fulfillJson(route, { id: factorMatch[1] });
    }
    if (url.pathname.endsWith('/factors') && method === 'POST') {
      const body = route.request().postDataJSON() as { friendly_name?: string };
      const name = body.friendly_name ?? '';
      if (factors.some((factor) => factor.friendly_name === name)) {
        return fulfillAuthError(
          route,
          'mfa_factor_name_conflict',
          `A factor with the friendly name "${name}" for this user already exists`,
          422,
        );
      }
      factors = [
        ...factors,
        { id: 'new-factor', factor_type: 'totp', status: 'unverified', friendly_name: name },
      ];
      return fulfillJson(route, {
        id: 'new-factor',
        type: 'totp',
        friendly_name: name,
        totp: {
          qr_code: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          secret: 'JBSWY3DPEHPK3PXP',
          uri: 'otpauth://totp/x',
        },
      });
    }
    return fulfillJson(route, {});
  });

  await page.goto('/my-profile');
  await page.getByRole('button', { name: 'Set up two-factor authentication' }).click();

  await expect(
    page.getByRole('img', { name: 'Scan this QR code with your authenticator app' }),
  ).toBeVisible();
  await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
  expect(deleted).toEqual(['stale-factor']);
});
