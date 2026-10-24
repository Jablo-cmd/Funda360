import { test, expect, type Page, type Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
} from './utils/mockData';

const GRANT_ID = '9a9a0000-0000-0000-0000-000000000001';

function grant(overrides: Record<string, unknown> = {}) {
  return {
    id: GRANT_ID,
    school_id: MOCK_TENANT_ID,
    requested_by: '11111111-1111-1111-1111-111111111111',
    requested_by_name: 'Jabulani Owner',
    requested_by_email: 'owner@funda360.test',
    scopes: ['safeguarding', 'messages'],
    reason: 'School reported missing concern history',
    duration_hours: 4,
    status: 'pending',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    starts_at: null,
    expires_at: null,
    revoked_by: null,
    revoked_at: null,
    created_at: '2026-10-24T08:00:00Z',
    ...overrides,
  };
}

function complianceOverview() {
  return {
    generated_at: '2026-10-24T08:00:00Z',
    school: { id: MOCK_TENANT_ID, name: 'Riverside Secondary School' },
    settings: {
      school_id: MOCK_TENANT_ID,
      frameworks: ['POPIA'],
      coppa_consent_age: 13,
      gdpr_digital_consent_age: 16,
      ferpa_amendment_response_days: 45,
      dsar_response_days: 30,
      content_filter_enabled: true,
      information_officer_name: 'Dr N. Dube',
      information_officer_email: 'privacy@riverside.test',
      privacy_notice_version: '2026-09',
      updated_by: null,
      updated_at: '2026-10-24T08:00:00Z',
    },
    learners: {
      active: 1,
      minors: 1,
      under_coppa_age: 0,
      under_coppa_with_online_consent: 0,
      core_processing_decided: 1,
      online_accounts_without_consent: 0,
    },
    consents: { granted: 1, refused: 0, withdrawn: 0 },
    dsar: { open: 0, overdue: 0, completed_90d: 0 },
    amendments: { open: 0, overdue: 0, hearings_requested: 0 },
    disclosures_90d: 0,
    access_events_30d: 0,
    audit_events_30d: 0,
    content_safety: { active_rules: 0, open_events: 0, events_30d: 0 },
    mfa: { privileged_accounts: 1, privileged_with_mfa: 1 },
    rls: { tables: 1, forced: 1 },
  };
}

async function mockGrants(page: Page, rows: () => unknown[]) {
  await page.route('**/rest/v1/platform_support_grants*', (route: Route) =>
    fulfillJson(route, rows()),
  );
}

test('a school owner approves a support access request in the Trust Center', async ({ page }) => {
  let rows = [grant()];
  let decided: Record<string, unknown> | null = null;

  await seedAuthenticatedSession(page, { role: 'school_owner' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'school_owner' }),
    school: buildMockSchoolRow(),
  });
  await page.route('**/rest/v1/rpc/get_compliance_overview', (route) =>
    fulfillJson(route, complianceOverview()),
  );
  await mockGrants(page, () => rows);
  await page.route('**/rest/v1/rpc/decide_platform_support_access', async (route) => {
    decided = route.request().postDataJSON() as Record<string, unknown>;
    const approved = grant({
      status: 'approved',
      decided_at: '2026-10-24T08:05:00Z',
      starts_at: '2026-10-24T08:05:00Z',
      expires_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
      decision_note: 'Fine for today',
    });
    rows = [approved];
    await fulfillJson(route, approved);
  });

  await page.goto('/compliance#support-access');
  await expect(page.getByRole('heading', { name: 'Support access' })).toBeVisible();
  await expect(page.getByText('Safeguarding concerns, Messages')).toBeVisible();
  await expect(page.getByText('Waiting for the school')).toBeVisible();

  await page.getByLabel('Note (optional)').fill('Fine for today');
  await page.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End access now' })).toBeVisible();
  expect(decided).toEqual({ p_grant_id: GRANT_ID, p_approve: true, p_note: 'Fine for today' });
});

test("a platform owner viewing a school's Trust Center sees the request but cannot decide it", async ({
  page,
}) => {
  await seedAuthenticatedSession(page, { role: 'platform_owner' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'platform_owner' }),
    school: buildMockSchoolRow(),
  });
  await page.route('**/rest/v1/rpc/get_compliance_overview', (route) =>
    fulfillJson(route, complianceOverview()),
  );
  await mockGrants(page, () => [grant()]);

  await page.goto('/compliance#support-access');
  await expect(page.getByText('Waiting for the school')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
});

test('a platform owner requests support access for one school', async ({ page }) => {
  let rows: unknown[] = [];
  let requested: Record<string, unknown> | null = null;

  await seedAuthenticatedSession(page, { role: 'platform_owner' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'platform_owner' }),
    school: buildMockSchoolRow(),
  });
  await page.route('**/rest/v1/schools*', (route) => {
    const url = new URL(route.request().url());
    const school = buildMockSchoolRow();
    return fulfillJson(route, url.searchParams.has('id') ? school : [school]);
  });
  await mockGrants(page, () => rows);
  await page.route('**/rest/v1/rpc/request_platform_support_access', async (route) => {
    requested = route.request().postDataJSON() as Record<string, unknown>;
    rows = [grant({ requested_by: '11111111-1111-1111-1111-111111111111' })];
    await fulfillJson(route, rows[0]);
  });

  await page.goto('/support-access');
  await expect(page.getByRole('heading', { name: 'Support access', exact: true })).toBeVisible();
  await expect(page.getByText('No support access requested yet.')).toBeVisible();

  const send = page.getByRole('button', { name: 'Send request' });
  await expect(send).toBeDisabled();

  await page.getByLabel('School').selectOption(MOCK_TENANT_ID);
  await page.getByLabel('Safeguarding concerns').check();
  await page.getByLabel('Messages').check();
  await page.getByLabel('Hours (1 to 72)').fill('4');
  await page
    .getByLabel('Reason (at least 10 characters)')
    .fill('School reported missing concern history');
  await send.click();

  await expect(page.getByText('Waiting for the school')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Withdraw request' })).toBeVisible();
  expect(requested).toEqual({
    p_school_id: MOCK_TENANT_ID,
    p_scopes: ['safeguarding', 'messages'],
    p_reason: 'School reported missing concern history',
    p_duration_hours: 4,
  });
});

test('a school role cannot open the platform Support Access page', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school: buildMockSchoolRow(),
  });

  await page.goto('/support-access');
  await expect(page).not.toHaveURL(/\/support-access$/);
});
