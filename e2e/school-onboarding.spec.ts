import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession, fulfillJson } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

const NEW_SCHOOL = buildMockSchoolRow({ id: 'school-new', name: 'Riverside Secondary School' });

test.describe('school onboarding wizard (FND-BIZ-001)', () => {
  test('a platform admin can create a school, its first admin account, and skip the academic year step', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'platform_administrator' });
    await installDataMocks(page, { profile: buildMockProfileRow({ role: 'platform_administrator', tenantId: null }) });

    // listAvailableSchools() (GET, no id filter) and createSchool() (POST) both
    // hit /schools — installDataMocks leaves it unmocked when `school` is
    // omitted, so this test owns the whole endpoint itself.
    await page.route('**/rest/v1/schools*', async (route) => {
      if (route.request().method() === 'POST') {
        return fulfillJson(route, NEW_SCHOOL);
      }
      // getSchoolById(tenantId) — TenantProvider's loadTenant() re-fetches
      // the just-created school by id right after createSchool() — a
      // single-row (`.maybeSingle()`) lookup, distinct from
      // listAvailableSchools()'s unfiltered list query below.
      const url = new URL(route.request().url());
      if (url.searchParams.get('id') === `eq.${NEW_SCHOOL.id}`) {
        return fulfillJson(route, NEW_SCHOOL);
      }
      return fulfillJson(route, []);
    });

    await page.route('**/rest/v1/rpc/admin_create_user', async (route) => {
      const body = route.request().postDataJSON();
      expect(body.p_tenant_id).toBe('school-new');
      expect(body.p_role).toBe('school_owner');
      return fulfillJson(route, [{ user_id: 'new-owner-1', temporary_password: 'Tmp-Passw0rd-1234' }]);
    });

    await page.goto('/schools/onboard');
    await expect(page.getByRole('heading', { name: 'Onboard a new school' })).toBeVisible();

    // Step 1 — school details
    await page.getByLabel('School name').fill('Riverside Secondary School');
    await page.getByRole('button', { name: 'Create school and continue' }).click();

    // Step 2 — first admin account
    await expect(page.getByText(/has been created/)).toBeVisible();
    await page.getByLabel('First name').fill('Ada');
    await page.getByLabel('Last name').fill('Owner');
    await page.getByLabel('Email').fill('ada.owner@riverside.funda360.dev');
    await page.getByRole('button', { name: 'Create account and continue' }).click();

    // Step 3 — academic year (skipped)
    await expect(page.getByText('Tmp-Passw0rd-1234')).toBeVisible();
    await page.getByRole('button', { name: 'Skip this step' }).click();

    // Step 4 — done
    await expect(page.getByText('Continuing will make it your active school')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to school profile' })).toBeVisible();
  });

  test('step 1 requires a school name before continuing', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'platform_administrator' });
    await installDataMocks(page, { profile: buildMockProfileRow({ role: 'platform_administrator', tenantId: null }) });
    await page.route('**/rest/v1/schools*', async (route) => fulfillJson(route, []));

    await page.goto('/schools/onboard');
    await page.getByRole('button', { name: 'Create school and continue' }).click();

    await expect(page.getByText('School name must be at least 2 characters')).toBeVisible();
  });

  test('a role without tenant.switch cannot reach the onboarding wizard', async ({ page }) => {
    await seedAuthenticatedSession(page, { role: 'teacher' });
    await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

    await page.goto('/schools/onboard');

    await expect(page).not.toHaveURL(/\/schools\/onboard$/);
  });
});
