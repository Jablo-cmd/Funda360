import { test, expect, type Page, type Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockGradeRow,
  installDataMocks,
} from './utils/mockData';

function applicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    school_id: MOCK_TENANT_ID,
    academic_year_id: 'year-2026',
    requested_grade_id: 'grade-1',
    reference_number: 'APP-2026-00001',
    status: 'submitted',
    resume_token: 'tok-1',
    applicant_first_name: 'Pam',
    applicant_last_name: 'Parent',
    applicant_email: 'pam@family.test',
    applicant_phone: null,
    applicant_relationship: 'mother',
    learner_first_name: 'Kid',
    learner_last_name: 'Applicant',
    learner_date_of_birth: '2021-05-01',
    learner_gender: null,
    learner_id_number: null,
    learner_nationality: null,
    learner_home_language: null,
    prior_school: null,
    additional_notes: null,
    interview_at: null,
    assessment_at: null,
    decision_at: null,
    decision_by: null,
    decision_reason: null,
    converted_learner_id: null,
    submitted_at: '2026-03-01T00:00:00Z',
    is_public_submission: true,
    created_by: null,
    updated_by: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

async function installAcademicRefMocks(page: Page) {
  for (const [path, rows] of [
    ['classes', [buildMockClassRow({ id: 'class-1', name: 'Grade 1A' })]],
    ['grades', [buildMockGradeRow({ id: 'grade-1', name: 'Grade 1' })]],
  ] as const) {
    await page.route(`**/rest/v1/${path}*`, async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await fulfillJson(route, rows);
    });
  }
  await page.route('**/rest/v1/admission_application_events*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/admission_application_documents*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
}

test('an admissions officer sees the pipeline dashboard and applications list', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'admissions_officer' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'admissions_officer' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-2026' })],
  });
  await installAcademicRefMocks(page);
  await page.route('**/rest/v1/admission_applications*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [applicationRow(), applicationRow({ id: 'app-2', status: 'accepted', learner_first_name: 'Second', reference_number: 'APP-2026-00002' })]);
  });

  await page.goto('/admissions');
  await expect(page.getByRole('heading', { name: 'Admissions' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kid Applicant' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Second Applicant' })).toBeVisible();
});

test('an admissions officer works an application through the workflow and converts it', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'admissions_officer' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'admissions_officer' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-2026' })],
  });
  await installAcademicRefMocks(page);

  let status = 'submitted';
  await page.route('**/rest/v1/admission_applications*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, applicationRow({ status }));
  });
  await page.route('**/rest/v1/rpc/transition_admission_application', async (route) => {
    const body = route.request().postDataJSON() as { p_to: string };
    status = body.p_to;
    await fulfillJson(route, applicationRow({ status }));
  });
  await page.route('**/rest/v1/rpc/convert_admission_application', async (route) => {
    status = 'enrolled';
    await fulfillJson(route, applicationRow({ status, converted_learner_id: 'learner-9' }));
  });

  await page.goto('/admissions/app-1');
  await expect(page.getByRole('heading', { name: 'Kid Applicant' })).toBeVisible();

  await page.getByRole('button', { name: 'Under review' }).click();
  await page.getByRole('button', { name: 'Accepted' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByRole('button', { name: 'Convert to learner' })).toBeVisible();
});

test('a role without admission.view cannot reach admissions', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  await page.goto('/admissions');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Admissions' })).toHaveCount(0);
});

test('the public application form renders for a valid school link', async ({ page }) => {
  await page.route('**/functions/v1/admissions-public', async (route) => {
    const body = route.request().postDataJSON() as { action: string };
    if (body.action === 'config') {
      await fulfillJson(route, {
        school: { id: MOCK_TENANT_ID, name: 'Riverside Secondary School' },
        academicYears: [{ id: 'year-2026', name: '2026', start_date: '2026-01-01', is_active: true }],
        grades: [{ id: 'grade-1', name: 'Grade 1', sort_order: 0 }],
        requirements: [{ id: 'req-1', label: 'Birth certificate', description: null, required: true, grade_id: null }],
      });
      return;
    }
    await fulfillJson(route, { error: 'unexpected' }, 400);
  });

  await page.goto(`/apply?school=${MOCK_TENANT_ID}`);
  await expect(page.getByText('Riverside Secondary School')).toBeVisible();
  await expect(page.getByText('Application for admission')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit application' })).toBeVisible();
  await expect(page.getByText('Birth certificate')).toBeVisible();
});
