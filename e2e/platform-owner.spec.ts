import { test, expect, type Page } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { MOCK_TENANT_ID, buildMockProfileRow, buildMockSchoolRow } from './utils/mockData';

const SCHOOL = buildMockSchoolRow();

function overview() {
  return {
    generated_at: '2026-10-24T10:00:00Z',
    schools: {
      total: 6,
      active: 5,
      pending: 1,
      suspended: 0,
      created_30d: 1,
      without_education_area: 6,
      list: [
        {
          id: MOCK_TENANT_ID,
          name: SCHOOL.name,
          status: 'active',
          created_at: '2026-08-02T10:00:00Z',
          learners: 375,
          staff: 18,
          guardians: 648,
        },
      ],
    },
    learners: { active: 375 },
    users: {
      total: 704,
      staff: 54,
      guardians: 648,
      learners: 0,
      platform: 2,
      signed_in_7d: 1,
      signed_in_30d: 4,
      demo_accounts: 702,
    },
    security: {
      privileged_accounts: 15,
      privileged_with_mfa: 0,
      platform_accounts: 2,
      platform_with_mfa: 0,
      platform_demo_accounts: 1,
      support_pending: 1,
      support_active: 0,
    },
    health: {
      latest_migration: '20261024091000',
      scheduled_job_failures_24h: 0,
      notifications_pending: 0,
      notifications_failed_7d: 0,
      unverified_payment_callbacks_7d: 0,
      ai_requests_7d: 0,
    },
    compliance: {
      open_data_requests: 0,
      overdue_data_requests: 0,
      open_amendment_requests: 0,
      open_content_safety_events: 0,
    },
    government: { education_areas: 0, active_official_assignments: 0, active_api_clients: 0 },
    recent_admin_actions: [
      {
        at: '2026-10-24T09:00:00Z',
        action: 'platform_support_access_requested',
        school: SCHOOL.name,
        by: 'Jabulani Owner',
      },
    ],
  };
}

async function signInAsPlatformOwner(page: Page) {
  await seedAuthenticatedSession(page, { role: 'platform_owner' });
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/profiles')) {
      return fulfillJson(
        route,
        buildMockProfileRow({
          role: 'platform_owner',
          firstName: 'Jabulani',
          tenantId: null as unknown as string,
        }),
      );
    }
    if (url.pathname.endsWith('/schools')) {
      return fulfillJson(route, url.searchParams.has('id') ? SCHOOL : [SCHOOL]);
    }
    if (url.pathname.endsWith('/rpc/get_platform_overview')) return fulfillJson(route, overview());
    if (url.pathname.includes('/rpc/')) return fulfillJson(route, []);
    return fulfillJson(route, []);
  });
}

function sidebar(page: Page) {
  return page.getByRole('navigation', { name: 'Main' }).first();
}

test('the platform owner dashboard shows real platform figures and what needs attention', async ({
  page,
}) => {
  await signInAsPlatformOwner(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Welcome back, Jabulani' })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByText('active of 6 · 1 new this month')).toBeVisible();
  await expect(main.getByText('0 of 2', { exact: true })).toBeVisible();
  await expect(
    main.getByRole('link', { name: /2 platform accounts without two-factor authentication/ }),
  ).toBeVisible();
  await expect(
    main.getByRole('link', { name: /1 demo account still has platform-level access/ }),
  ).toBeVisible();
  await expect(main.getByRole('link', { name: /1 support access request waiting/ })).toBeVisible();
  await expect(main.getByText('20261024091000')).toBeVisible();
  await expect(main.getByRole('cell', { name: SCHOOL.name })).toBeVisible();
  await expect(main.getByRole('cell', { name: '648' })).toBeVisible();
  await expect(main.getByText('Platform support access requested')).toBeVisible();
  // The old placeholder tiles are gone.
  await expect(main.getByText('Manage', { exact: true })).toHaveCount(0);
});

test('without a school the platform owner gets a platform menu, not a school menu', async ({
  page,
}) => {
  await signInAsPlatformOwner(page);
  await page.goto('/dashboard');

  const nav = sidebar(page);
  for (const label of [
    'Dashboard',
    'Schools',
    'Users & Roles',
    'Support Access',
    'Provincial Dashboard',
    'My Profile',
  ]) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  for (const label of [
    'Learners',
    'Safeguarding',
    'Attendance',
    'Invoices',
    'Leave Requests',
    'Messages',
  ]) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }
});

test('inside a chosen school the platform owner gets that school menu, a banner, and a way back', async ({
  page,
}) => {
  await signInAsPlatformOwner(page);
  await page.goto('/schools');
  await page.getByRole('button', { name: 'Switch to this school' }).first().click();

  const banner = page.getByRole('status').filter({ hasText: `Working inside ${SCHOOL.name}` });
  await expect(banner).toBeVisible();
  const nav = sidebar(page);
  await expect(nav.getByRole('link', { name: 'Learners', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Trust Center', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Messages', exact: true })).toHaveCount(0);

  await banner.getByRole('button', { name: 'Leave school' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('status').filter({ hasText: 'Working inside' })).toHaveCount(0);
  await expect(sidebar(page).getByRole('link', { name: 'Learners', exact: true })).toHaveCount(0);
});
