import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

/**
 * Government reporting UI. The data is mocked; isolation itself is proven by
 * supabase/rls-tests/tests/zz_government_reporting.test.sql. These tests
 * check that the UI shows what the database returns, offers only the
 * official's pages, and surfaces a database refusal (an out-of-scope id in
 * the URL) as a permission message rather than data.
 */

const SCHOOL_ONE = '0e000000-0000-0000-0000-000000000001';
const SCHOOL_OTHER = '0e000000-0000-0000-0000-000000000099';
const CLASS_ONE = '0c000000-0000-0000-0000-000000000001';

const SCOPE = {
  caller_kind: 'official',
  learner_detail: false,
  areas: [
    { id: 'a0000000-0000-0000-0000-000000000001', level: 'province', parent_id: null, name: 'Test Province', code: null },
    {
      id: 'a0000000-0000-0000-0000-000000000011',
      level: 'district',
      parent_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Metro District',
      code: null,
    },
  ],
  schools: [
    { id: SCHOOL_ONE, name: 'Thembalethu Secondary', emis_number: '900000001', education_area_id: 'a0000000-0000-0000-0000-000000000011', status: 'active' },
    { id: '0e000000-0000-0000-0000-000000000002', name: 'Riverside Primary', emis_number: null, education_area_id: 'a0000000-0000-0000-0000-000000000011', status: 'active' },
  ],
  grades: ['Grade 10'],
  academic_years: ['2026'],
  terms: [1, 2],
};

function school(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    emis_number: '900000001',
    status: 'active',
    province: 'Test Province',
    district_id: 'a0000000-0000-0000-0000-000000000011',
    district: 'Metro District',
    circuit_id: null,
    circuit: null,
    academic_year: '2026',
    period_start: '2026-01-12',
    period_end: '2026-10-08',
    learners_active: 420,
    learners_enrolled: 410,
    educators: 14,
    staff: 20,
    classes: 12,
    learner_educator_ratio: 29.3,
    attendance_rate: 91.2,
    attendance_records: 18000,
    average_percent: 61.4,
    pass_rate: 78.5,
    assessment_results: 3200,
    learners_requiring_intervention: 22,
    interventions: { open: 3, in_progress: 2, overdue: 0, resolved: 4 },
    data_quality: {},
    attention: [],
    learner_detail: false,
    ...overrides,
  };
}

const REPORT = {
  generated_at: '2026-10-08T08:00:00Z',
  filters: {},
  thresholds: { attendance: 80, performance: 50, minimum_group_size: 5 },
  summary: {
    schools: 2,
    learners_active: 640,
    learners_enrolled: 620,
    educators: 21,
    staff: 30,
    classes: 19,
    attendance_rate: 87.4,
    attendance_records: 26000,
    average_percent: 57.9,
    pass_rate: 72.1,
    assessment_results: 4100,
    learners_requiring_intervention: 61,
    schools_requiring_attention: 1,
    schools_with_data_quality_issues: 1,
    interventions: { open: 5, in_progress: 2, overdue: 3, resolved: 4 },
  },
  schools: [
    school(SCHOOL_ONE, 'Thembalethu Secondary'),
    school('0e000000-0000-0000-0000-000000000002', 'Riverside Primary', {
      emis_number: null,
      learners_enrolled: 210,
      attendance_rate: 74.1,
      attention: ['low_attendance', 'overdue_interventions', 'data_quality'],
      interventions: { open: 2, in_progress: 0, overdue: 3, resolved: 0 },
      data_quality: { missing_emis_number: true, classes_without_attendance: 2 },
    }),
  ],
  areas: [],
  grades: [
    { grade: 'Grade 10', learners: 410, schools: 1, classes: 12, suppressed: false, attendance_rate: 91.2, average_percent: 61.4, pass_rate: 78.5, assessment_results: 3200 },
    { grade: 'Grade 12', learners: 3, schools: 1, classes: 1, suppressed: true, attendance_rate: null, average_percent: null, pass_rate: null, assessment_results: 12 },
  ],
  subjects: [{ subject: 'Mathematics', schools: 2, learners: 600, assessment_results: 1200, suppressed: false, average_percent: 48.2, pass_rate: 51.0 }],
  attendance_trend: [
    { period: '2026-09-07', attendance_rate: 88.1, records: 3000 },
    { period: '2026-09-14', attendance_rate: 86.9, records: 3000 },
  ],
  performance_trend: [{ period: '2026-09-01', average_percent: 57.9, results: 900 }],
};

const SCHOOL_REPORT = {
  generated_at: '2026-10-08T08:00:00Z',
  school: { id: SCHOOL_ONE, name: 'Thembalethu Secondary', emis_number: '900000001', status: 'active', education_area_id: null },
  period: { academic_year: '2026', start: '2026-01-12', end: '2026-10-08' },
  learner_detail: false,
  thresholds: { attendance: 80, performance: 50, minimum_group_size: 5 },
  classes: [
    { id: CLASS_ONE, name: '10A', grade: 'Grade 10', learners: 35, suppressed: false, attendance_rate: 92.0, average_percent: 63.0, pass_rate: 80.0, learners_requiring_intervention: 4, assessments: 6, last_attendance_date: '2026-10-07' },
    { id: '0c000000-0000-0000-0000-000000000002', name: '10B', grade: 'Grade 10', learners: 3, suppressed: true, attendance_rate: null, average_percent: null, pass_rate: null, learners_requiring_intervention: null, assessments: 0, last_attendance_date: null },
  ],
};

interface RpcCalls {
  exports: Array<{ p_report: string; p_format: string }>;
  reportFilters: unknown[];
}

async function signInAs(page: Page, role: string, calls: RpcCalls = { exports: [], reportFilters: [] }) {
  await seedAuthenticatedSession(page, { role });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: role as 'principal', tenantId: role === 'education_official' ? null : undefined, firstName: 'Nomsa' }),
    school: role === 'education_official' ? undefined : buildMockSchoolRow(),
  });
  await page.route('**/rest/v1/rpc/**', async (route: Route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop();
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    switch (fn) {
      case 'get_reporting_scope':
        return fulfillJson(route, SCOPE);
      case 'get_government_report':
        calls.reportFilters.push(body?.p_filters);
        return fulfillJson(route, REPORT);
      case 'get_school_report':
        if (body?.p_school_id !== SCHOOL_ONE) {
          return fulfillJson(route, { code: 'P0001', message: 'insufficient_privilege: this school is outside your reporting scope' }, 400);
        }
        return fulfillJson(route, SCHOOL_REPORT);
      case 'record_government_report_export':
        calls.exports.push(body as { p_report: string; p_format: string });
        return fulfillJson(route, null);
      default:
        return route.fallback();
    }
  });
  return calls;
}

test('an education official lands on the district dashboard and sees only government pages', async ({ page }) => {
  await signInAs(page, 'education_official');
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/district$/);
  await expect(page.getByRole('heading', { level: 1, name: 'District dashboard' })).toBeVisible();

  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: 'District Dashboard' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Government Reports' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Learners' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Messages' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Education Areas' })).toHaveCount(0);
});

test('the dashboard shows the database figures, flags schools and withholds small groups', async ({ page }) => {
  await signInAs(page, 'education_official');
  await page.goto('/district');

  const overview = page.getByRole('region', { name: 'Overview' });
  await expect(overview.getByText('620', { exact: true })).toBeVisible();
  await expect(overview.getByText('87.4%')).toBeVisible();
  await expect(overview.getByText('61', { exact: true })).toBeVisible();

  const schoolsTable = page.getByRole('table').first();
  // The school needing attention is listed first.
  await expect(schoolsTable.getByRole('row').nth(1)).toContainText('Riverside Primary');
  await expect(schoolsTable.getByRole('row').nth(1)).toContainText('Low attendance');
  await expect(schoolsTable.getByRole('row').nth(2)).toContainText('On track');

  await expect(page.getByText('Withheld').first()).toBeVisible();
  await expect(page.getByText('No EMIS number · Classes with no attendance recorded (2)')).toBeVisible();
});

test('filters are sent to the database and kept in the URL', async ({ page }) => {
  const calls = await signInAs(page, 'education_official');
  await page.goto('/district');
  await expect(page.getByRole('heading', { level: 1, name: 'District dashboard' })).toBeVisible();

  await page.getByLabel('Term').selectOption('2');
  await expect(page).toHaveURL(/term=2/);
  await expect.poll(() => JSON.stringify(calls.reportFilters.at(-1))).toContain('"term":"2"');
});

test('drill-down goes from district to school to classes, without learner names for aggregate access', async ({ page }) => {
  await signInAs(page, 'education_official');
  await page.goto('/district');
  await page.getByRole('link', { name: 'Thembalethu Secondary' }).first().click();

  await expect(page).toHaveURL(new RegExp(`/district/schools/${SCHOOL_ONE}`));
  await expect(page.getByRole('heading', { level: 2, name: 'Grade 10' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '10A' })).toBeVisible();
  // No learner-level grant: classes are not links to learner lists.
  await expect(page.getByRole('link', { name: '10A' })).toHaveCount(0);
  await expect(page.getByText('Learner names are only shown to officials granted learner-level access.')).toBeVisible();
});

test('a school id outside the official\'s scope in the URL shows a permission message, not data', async ({ page }) => {
  await signInAs(page, 'education_official');
  await page.goto(`/district/schools/${SCHOOL_OTHER}`);

  await expect(page.getByText("You don't have permission to do this.").first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '10A' })).toHaveCount(0);
});

test('government report exports are recorded before the file is produced', async ({ page }) => {
  const calls = await signInAs(page, 'education_official');
  await page.goto('/reports/government?report=attendance');
  await expect(page.getByRole('heading', { level: 2, name: 'Attendance' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Riverside Primary' })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;

  expect(file.suggestedFilename()).toMatch(/^funda360-attendance-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(calls.exports).toEqual([expect.objectContaining({ p_report: 'attendance', p_format: 'csv' })]);
});

test('a teacher cannot open the district dashboard', async ({ page }) => {
  await signInAs(page, 'teacher');
  await page.goto('/district');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'District dashboard' })).toHaveCount(0);
});

test('the district dashboard does not scroll sideways on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signInAs(page, 'education_official');
  await page.goto('/district');
  await expect(page.getByRole('heading', { level: 1, name: 'District dashboard' })).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible();

  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? main.scrollWidth - main.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
