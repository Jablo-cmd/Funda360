import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, installDataMocks } from './utils/mockData';

/**
 * Provincial Dashboard and Government Integrations UI. Data is mocked;
 * province isolation and API scope are proven in the database by
 * supabase/rls-tests/tests/zzz_provincial_and_api.test.sql.
 */

const PROVINCE = 'a0000000-0000-0000-0000-000000000001';
const NORTH = 'a0000000-0000-0000-0000-000000000011';
const SOUTH = 'a0000000-0000-0000-0000-000000000012';
const SCHOOL_ONE = '0e000000-0000-0000-0000-000000000001';

const SCOPE = {
  caller_kind: 'official',
  learner_detail: false,
  areas: [
    { id: PROVINCE, level: 'province', parent_id: null, name: 'Test Province', code: 'TP' },
    { id: NORTH, level: 'district', parent_id: PROVINCE, name: 'North District', code: null },
    { id: SOUTH, level: 'district', parent_id: PROVINCE, name: 'South District', code: null },
  ],
  schools: [
    {
      id: SCHOOL_ONE,
      name: 'Thembalethu Secondary',
      emis_number: '900000001',
      education_area_id: NORTH,
      status: 'active',
    },
  ],
  grades: ['Grade 10'],
  academic_years: ['2026'],
  terms: [1, 2],
};

function district(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    district_id: id,
    district: name,
    code: null,
    circuits: 0,
    schools: 3,
    learners_enrolled: 900,
    learners_active: 920,
    educators: 30,
    staff: 40,
    classes: 27,
    attendance_rate: 91.0,
    attendance_records: 30000,
    average_percent: 62.0,
    assessment_results: 5000,
    learners_requiring_intervention: 40,
    interventions: { open: 4, in_progress: 1, overdue: 0, resolved: 6 },
    schools_requiring_attention: 0,
    schools_with_data_quality_issues: 0,
    data_quality_issues: 0,
    requires_attention: false,
    attention: [],
    insufficient_data: false,
    ...overrides,
  };
}

const REPORT = {
  generated_at: '2026-10-08T08:00:00Z',
  province: { id: PROVINCE, name: 'Test Province', code: 'TP' },
  filters: { province_id: PROVINCE },
  thresholds: { attendance: 80, performance: 50, minimum_group_size: 5 },
  summary: {
    schools: 5,
    learners_active: 1520,
    learners_enrolled: 1480,
    educators: 48,
    staff: 66,
    classes: 44,
    attendance_rate: 86.2,
    attendance_records: 52000,
    average_percent: 58.4,
    pass_rate: 70.2,
    assessment_results: 8100,
    learners_requiring_intervention: 133,
    schools_requiring_attention: 2,
    schools_with_data_quality_issues: 2,
    interventions: { open: 9, in_progress: 3, overdue: 5, resolved: 6 },
    districts: 2,
    districts_requiring_attention: 1,
    data_quality_issues: 3,
  },
  districts: [
    district(NORTH, 'North District', { circuits: 2 }),
    district(SOUTH, 'South District', {
      schools: 2,
      learners_enrolled: 580,
      attendance_rate: 74.3,
      average_percent: 49.1,
      interventions: { open: 5, in_progress: 2, overdue: 5, resolved: 0 },
      schools_requiring_attention: 2,
      schools_with_data_quality_issues: 2,
      data_quality_issues: 3,
      requires_attention: true,
      attention: [
        'schools_requiring_attention',
        'low_attendance',
        'low_performance',
        'overdue_interventions',
      ],
    }),
  ],
  schools: [
    {
      id: SCHOOL_ONE,
      name: 'Thembalethu Secondary',
      district: 'North District',
      circuit: null,
    },
  ],
  grades: [],
  subjects: [],
  attendance_trend: [
    { period: '2026-09-07', attendance_rate: 87.1, records: 5000 },
    { period: '2026-09-14', attendance_rate: 85.9, records: 5000 },
  ],
  performance_trend: [{ period: '2026-09-01', average_percent: 58.4, results: 900 }],
  intervention_trend: [{ period: '2026-09-01', opened: 7, resolved: 2 }],
  data_quality: {
    issue_counts: {
      missing_emis_number: { schools: 2, total: 2 },
      incomplete_learner_records: { schools: 1, total: 14 },
    },
    schools: [
      {
        id: '0e000000-0000-0000-0000-000000000005',
        name: 'Riverside Primary',
        district_id: SOUTH,
        district: 'South District',
        circuit: null,
        issues: { missing_emis_number: true, incomplete_learner_records: 14 },
      },
    ],
    unlinked_schools: null,
  },
};

interface Calls {
  rpcs: string[];
  reportArgs: Record<string, unknown>[];
  exports: Record<string, unknown>[];
  bodies: Record<string, Record<string, unknown>>;
}

const PRIVILEGED = new Set([
  'education_official',
  'platform_owner',
  'super_administrator',
  'platform_administrator',
]);

async function signInAs(
  page: Page,
  role: string,
  options: { provinces?: unknown[]; mfa?: 'verified' | 'none' } = {},
): Promise<Calls> {
  const calls: Calls = { rpcs: [], reportArgs: [], exports: [], bodies: {} };
  const verified = (options.mfa ?? 'verified') === 'verified' && PRIVILEGED.has(role);
  await seedAuthenticatedSession(page, {
    role,
    aal: PRIVILEGED.has(role) ? (verified ? 'aal2' : 'aal1') : undefined,
    factors: verified ? [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] : [],
  });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: role as 'principal', tenantId: null, firstName: 'Nomsa' }),
  });
  await page.route('**/rest/v1/education_areas*', (route) =>
    fulfillJson(
      route,
      SCOPE.areas.map((a) => ({
        ...a,
        created_by: null,
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
      })),
    ),
  );
  await page.route('**/rest/v1/schools*', (route) =>
    fulfillJson(route, [
      {
        id: SCHOOL_ONE,
        name: 'Thembalethu Secondary',
        emis_number: null,
        province: null,
        district: null,
        education_area_id: NORTH,
      },
    ]),
  );
  await page.route('**/rest/v1/rpc/**', async (route: Route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const body = (route.request().postDataJSON() as Record<string, unknown> | null) ?? {};
    calls.rpcs.push(fn);
    calls.bodies[fn] = body;
    switch (fn) {
      case 'get_reporting_scope':
        return fulfillJson(route, SCOPE);
      case 'get_provincial_scope':
        return fulfillJson(
          route,
          options.provinces ?? [{ id: PROVINCE, name: 'Test Province', code: 'TP' }],
        );
      case 'get_provincial_report':
        calls.reportArgs.push(body);
        return fulfillJson(route, REPORT);
      case 'record_provincial_report_export':
        calls.exports.push(body);
        return fulfillJson(route, null);
      case 'list_government_api_clients':
        return fulfillJson(route, [
          {
            id: 'c1',
            name: 'Provincial data warehouse',
            description: null,
            area_id: PROVINCE,
            school_id: null,
            scope_name: 'Test Province',
            scope_level: 'province',
            permissions: ['reports', 'schools'],
            learner_detail: false,
            rate_limit_per_minute: 60,
            token_prefix: '0123abcd',
            expires_at: null,
            created_at: '2026-10-01T00:00:00Z',
            revoked_at: null,
            last_used_at: '2026-10-08T07:00:00Z',
            requests_24h: 42,
            errors_24h: 1,
          },
        ]);
      case 'list_government_import_jobs':
        return fulfillJson(route, [
          {
            id: 'job-1',
            client_id: 'c1',
            client_name: 'Provincial data warehouse',
            kind: 'school_identifiers',
            status: 'validated',
            idempotency_key: 'import-0001',
            total_rows: 1,
            valid_rows: 1,
            error_rows: 0,
            rows: [
              {
                row: 1,
                school_id: SCHOOL_ONE,
                emis_number: '700100200',
                current_emis_number: null,
                action: 'set',
              },
            ],
            errors: [],
            created_at: '2026-10-08T07:30:00Z',
            reviewed_at: null,
            review_notes: null,
          },
        ]);
      case 'create_government_api_client':
        return fulfillJson(route, [{ client_id: 'c2', token: 'f360g_89abcdef_' + 'b'.repeat(48) }]);
      case 'revoke_government_api_client':
      case 'review_government_import_job':
        return fulfillJson(route, null);
      default:
        return route.fallback();
    }
  });
  return calls;
}

test('a province official sees provincial KPIs, the district comparison, trends and data quality', async ({
  page,
}) => {
  const calls = await signInAs(page, 'education_official');
  await page.goto('/province');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Test Province: provincial dashboard' }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`province_id=${PROVINCE}`));
  expect(calls.reportArgs[0]?.p_province_id).toBe(PROVINCE);

  const overview = page.getByRole('region', { name: 'Province overview' });
  // en-ZA grouping differs between ICU builds ("1,480" or "1 480" with a no-break space).
  await expect(overview.getByText(/^1[,\s\u00a0\u202f]?480$/)).toBeVisible();
  await expect(overview.getByText('86.2%')).toBeVisible();
  await expect(overview.getByText('Districts requiring attention')).toBeVisible();

  const table = page.getByRole('table').first();
  // Needing attention first by default.
  await expect(table.getByRole('row').nth(1)).toContainText('South District');
  await expect(table.getByRole('row').nth(1)).toContainText('Low attendance');
  await page.getByLabel('Order districts by').selectOption('name');
  await expect(table.getByRole('row').nth(1)).toContainText('North District');

  // One monthly point is not a trend.
  await expect(page.getByText('No sufficient data', { exact: true })).toBeVisible();
  await expect(page.getByText('Learners with no gender recorded: 1 school (14)')).toBeVisible();
  await expect(page.getByText('The order is a viewing choice, not a ranking.')).toBeVisible();

  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: 'Provincial Dashboard' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Integrations' })).toHaveCount(0);
});

test('district rows drill down to the district dashboard for that district', async ({ page }) => {
  await signInAs(page, 'education_official');
  await page.goto('/province');
  await page.getByRole('table').first().getByRole('link', { name: 'North District' }).click();
  await expect(page).toHaveURL(new RegExp(`/district\\?.*district_id=${NORTH}`));
});

test('filters are sent with the province and kept in the URL', async ({ page }) => {
  const calls = await signInAs(page, 'education_official');
  await page.goto(`/province?province_id=${PROVINCE}`);
  await expect(page.getByRole('region', { name: 'Province overview' })).toBeVisible();

  await page.getByLabel('Term').selectOption('2');
  await expect(page).toHaveURL(/term=2/);
  await expect.poll(() => JSON.stringify(calls.reportArgs.at(-1))).toContain('"term":"2"');
  expect(calls.reportArgs.at(-1)?.p_province_id).toBe(PROVINCE);
  expect(JSON.stringify(calls.reportArgs.at(-1)?.p_filters)).not.toContain('province_id');
});

test('exports are recorded through the province-checked function first', async ({ page }) => {
  const calls = await signInAs(page, 'education_official');
  await page.goto('/province');
  await expect(page.getByRole('region', { name: 'Province overview' })).toBeVisible();

  await page.getByRole('button', { name: 'CSV' }).first().click();
  await expect.poll(() => calls.exports.length).toBe(1);
  expect(calls.exports[0]).toMatchObject({
    p_province_id: PROVINCE,
    p_report: 'provincial_district_comparison',
    p_format: 'csv',
  });
  expect(calls.rpcs).not.toContain('record_government_report_export');
});

test('a district official without province-level access gets no provincial data', async ({
  page,
}) => {
  const calls = await signInAs(page, 'education_official', { provinces: [] });
  await page.goto(`/province?province_id=${PROVINCE}`);
  await expect(
    page.getByText('The provincial dashboard needs province-level access.'),
  ).toBeVisible();
  expect(calls.rpcs).not.toContain('get_provincial_report');
});

test('an official without MFA sees the set-up step and no provincial request is made', async ({
  page,
}) => {
  const calls = await signInAs(page, 'education_official', { mfa: 'none' });
  await page.goto('/province');
  await expect(
    page.getByRole('heading', { name: 'Set up two-factor authentication' }),
  ).toBeVisible();
  expect(calls.rpcs).not.toContain('get_provincial_report');
});

for (const width of [320, 375]) {
  test(`the provincial dashboard has no sideways scroll at ${width}px and shows district cards`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await signInAs(page, 'education_official');
    await page.goto('/province');
    await expect(page.getByRole('list', { name: 'Districts' })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? main.scrollWidth - main.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

for (const width of [320, 375]) {
  test(`the integrations page has no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await signInAs(page, 'platform_administrator');
    await page.goto('/district/integrations');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Government integrations' }),
    ).toBeVisible();
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? main.scrollWidth - main.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('a platform administrator creates an API client and sees the token once', async ({ page }) => {
  const calls = await signInAs(page, 'platform_administrator');
  await page.goto('/district/integrations');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Government integrations' }),
  ).toBeVisible();
  await expect(page.getByText('Provincial data warehouse').first()).toBeVisible();

  await page.getByLabel('Client name').fill('District BI');
  await page.getByLabel('Scope').selectOption(`area:${NORTH}`);
  await page.getByRole('button', { name: 'Create API client' }).click();

  const dialog = page.getByRole('dialog', { name: 'API token created' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('f360g_89abcdef_')).toBeVisible();
  expect(calls.bodies.create_government_api_client).toMatchObject({
    p_name: 'District BI',
    p_area_id: NORTH,
    p_school_id: null,
    p_permissions: ['schools', 'reports'],
  });
  await dialog.getByRole('button', { name: 'Close' }).first().click();
  await expect(page.getByText('f360g_89abcdef_')).toHaveCount(0);
});

test('a platform administrator revokes a client and commits an import after confirming', async ({
  page,
}) => {
  const calls = await signInAs(page, 'platform_administrator');
  await page.goto('/district/integrations');

  await page.getByRole('button', { name: 'Revoke Provincial data warehouse' }).click();
  await page
    .getByRole('dialog', { name: 'Revoke API client' })
    .getByRole('button', { name: 'Revoke client' })
    .click();
  await expect.poll(() => calls.rpcs.includes('revoke_government_api_client')).toBe(true);
  expect(calls.bodies.revoke_government_api_client).toEqual({ p_client_id: 'c1' });

  await page.getByRole('button', { name: 'Commit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Commit import' });
  await expect(dialog.getByText('This updates the EMIS number of 1 schools.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Commit', exact: true }).click();
  await expect
    .poll(() => calls.bodies.review_government_import_job)
    .toMatchObject({ p_job_id: 'job-1', p_decision: 'commit' });
});

test('education officials cannot open the integrations page', async ({ page }) => {
  await signInAs(page, 'education_official');
  await page.goto('/district/integrations');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Government integrations' }),
  ).toHaveCount(0);
});

for (const [path, role, heading] of [
  ['/province', 'education_official', 'Test Province: provincial dashboard'],
  ['/district/integrations', 'platform_administrator', 'Government integrations'],
] as const) {
  test(`${path} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    await signInAs(page, role);
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
