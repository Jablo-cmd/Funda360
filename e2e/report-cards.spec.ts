import { test, expect, type Page, type Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockTermRow,
  buildMockGradeRow,
  buildMockLearnerRow,
  installDataMocks,
  installLearnerDetailMock,
} from './utils/mockData';

const TEMPLATE_ROW = {
  id: 'tpl-1',
  school_id: MOCK_TENANT_ID,
  name: 'Standard Term Report',
  grading_scale_id: 'scale-1',
  is_default: true,
  active: true,
  show_attendance: true,
  show_conduct: true,
  show_class_teacher_comment: true,
  show_principal_comment: true,
  show_subject_comments: true,
  show_promotion: true,
  requires_hod_review: false,
  header_note: null,
  footer_note: null,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const SCALE_ROW = {
  id: 'scale-1',
  school_id: MOCK_TENANT_ID,
  name: 'CAPS 7-point',
  description: null,
  is_default: true,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function reportCardRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rc-1',
    school_id: MOCK_TENANT_ID,
    learner_id: 'learner-1',
    academic_year_id: 'year-2026',
    term_id: 'term-1',
    grade_id: 'grade-1',
    class_id: 'class-1',
    template_id: 'tpl-1',
    batch_id: null,
    version: 1,
    status: 'draft',
    superseded_by: null,
    learner_name: 'Naledi Dube',
    learner_number: 'LRN-0001',
    class_teacher_comment: null,
    principal_comment: null,
    conduct_summary: null,
    promotion_status: 'not_applicable',
    overall_average_percentage: 65,
    overall_achievement_code: '5',
    overall_achievement_label: 'Substantial',
    attendance_present: 40,
    attendance_absent: 2,
    attendance_late: 1,
    attendance_excused: 0,
    attendance_total_days: 43,
    conduct_positive_count: 1,
    conduct_negative_count: 0,
    generated_at: '2026-03-25T00:00:00Z',
    submitted_at: null,
    submitted_by: null,
    reviewed_at: null,
    reviewed_by: null,
    approved_at: null,
    approved_by: null,
    published_at: null,
    published_by: null,
    archived_at: null,
    locked_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-03-25T00:00:00Z',
    updated_at: '2026-03-25T00:00:00Z',
    ...overrides,
  };
}

const SUBJECT_ROW = {
  id: 'rcs-1',
  report_card_id: 'rc-1',
  school_id: MOCK_TENANT_ID,
  subject_id: 'subject-1',
  subject_name: 'Mathematics',
  teacher_profile_id: null,
  teacher_name: 'T. Teacher',
  weight: 1,
  average_percentage: 65,
  achievement_code: '5',
  achievement_label: 'Substantial',
  teacher_comment: null,
  assessment_count: 2,
  sort_order: 0,
  created_at: '2026-03-25T00:00:00Z',
  updated_at: '2026-03-25T00:00:00Z',
};

async function installAcademicRefMocks(page: Page) {
  for (const [path, rows] of [
    ['classes', [buildMockClassRow({ id: 'class-1', name: 'Grade 8A' })]],
    ['terms', [buildMockTermRow({ id: 'term-1', name: 'Term 1' })]],
    ['grades', [buildMockGradeRow({ id: 'grade-1', name: 'Grade 8' })]],
    ['report_card_templates', [TEMPLATE_ROW]],
    ['grading_scales', [SCALE_ROW]],
    ['grading_scale_bands', []],
  ] as const) {
    await page.route(`**/rest/v1/${path}*`, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await fulfillJson(route, rows);
    });
  }
}

test('a principal generates report cards for a class and sees them listed', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-2026' })],
  });
  await installAcademicRefMocks(page);

  let generated = false;
  await page.route('**/rest/v1/report_cards*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, generated ? [reportCardRow()] : []);
  });
  await page.route('**/rest/v1/rpc/generate_report_cards_for_class', async (route) => {
    generated = true;
    await fulfillJson(route, {
      id: 'batch-1',
      school_id: MOCK_TENANT_ID,
      academic_year_id: 'year-2026',
      term_id: 'term-1',
      class_id: 'class-1',
      template_id: 'tpl-1',
      generated_count: 1,
      skipped_count: 0,
      created_by: null,
      created_at: '2026-03-25T00:00:00Z',
    });
  });

  await page.goto('/report-cards');
  await expect(page.getByRole('heading', { name: 'Report Cards' })).toBeVisible();

  await page.getByLabel('Filter by term').selectOption('term-1');
  await page.getByLabel('Filter by class').selectOption('class-1');
  await page.getByLabel('Report card template').selectOption('tpl-1');
  await page.getByRole('button', { name: 'Generate for class' }).click();

  await expect(page.getByRole('link', { name: 'Naledi Dube' })).toBeVisible();
  await expect(page.getByText('65% (5)')).toBeVisible();
});

test('a principal approves and publishes a report card from the detail page', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-2026' })],
  });
  await installAcademicRefMocks(page);

  let status = 'teacher_review';
  await page.route('**/rest/v1/report_cards*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [reportCardRow({ status })]);
  });
  await page.route('**/rest/v1/report_card_subjects*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [SUBJECT_ROW]);
  });
  await page.route('**/rest/v1/rpc/approve_report_card', async (route) => {
    status = 'approved';
    await fulfillJson(route, reportCardRow({ status, locked_at: '2026-03-26T00:00:00Z', approved_by: 'p1' }));
  });
  await page.route('**/rest/v1/rpc/publish_report_card', async (route) => {
    status = 'published';
    await fulfillJson(route, reportCardRow({ status, published_at: '2026-03-27T00:00:00Z' }));
  });

  await page.goto('/report-cards/rc-1');
  await expect(page.getByRole('heading', { name: 'Naledi Dube' })).toBeVisible();
  await expect(page.getByText('Mathematics')).toBeVisible();
  await expect(page.getByText('Staff preview.')).toBeVisible();

  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();

  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Staff preview.')).toHaveCount(0);
});

test('a guardian sees a published report card with a PDF download, never a draft', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'guardian' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-2026' })],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1' }));

  // RLS would return only published rows to a guardian — the mock mirrors that.
  await page.route('**/rest/v1/report_cards*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [reportCardRow({ status: 'published', published_at: '2026-03-27T00:00:00Z' })]);
  });

  await page.goto('/parent/children/learner-1');
  await page.getByRole('button', { name: 'Report cards', exact: true }).click();

  await expect(page.getByText(/Naledi Dube — v1/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
});

test('a role without reportcard.view cannot reach the report cards page', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'receptionist' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'receptionist' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  await page.goto('/report-cards');
  await expect(page.getByRole('heading', { name: 'Report Cards' })).toHaveCount(0);
});
