import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockLearnerRow,
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
} from './utils/mockData';

const LEARNER_ID = 'learner-1';

function assignmentRow() {
  return {
    id: 'hw-1',
    school_id: 'tenant-demo',
    academic_year_id: 'y1',
    term_id: null,
    class_id: 'c1',
    subject_id: 's1',
    assessment_id: null,
    title: 'Spelling list',
    instructions: 'Learn 10 words.',
    due_at: '2026-09-20T12:00:00Z',
    max_points: null,
    allow_resubmission: false,
    status: 'published',
    rubric: [],
    published_at: '2026-09-08T09:00:00Z',
    closed_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-09-08T09:00:00Z',
    classes: { name: 'Grade 3A' },
    subjects: { name: 'English' },
  };
}

test('a guardian sees homework and applications on the Parent Portal', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const row = buildMockLearnerRow({ id: LEARNER_ID, firstName: 'Lerato', lastName: 'M' });
    return fulfillJson(route, url.searchParams.has('id') ? row : [row]);
  });
  await page.route('**/rest/v1/assignment_submissions*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, [
      {
        id: 'sub-1',
        assignment_id: 'hw-1',
        learner_id: LEARNER_ID,
        status: 'assigned',
        submission_text: null,
        submitted_at: null,
        is_late: false,
        attempt_count: 0,
        points_awarded: null,
        rubric_scores: {},
        teacher_feedback: null,
        marked_at: null,
        returned_at: null,
        learners: { first_name: 'Lerato', last_name: 'M' },
        assignments: assignmentRow(),
      },
    ]);
  });
  await page.route('**/rest/v1/rpc/get_my_admission_applications', async (route) =>
    fulfillJson(route, [
      {
        id: 'app-1',
        school_id: 'tenant-demo',
        reference_number: 'APP-2026-00007',
        status: 'under_review',
        learner_first_name: 'Baby',
        learner_last_name: 'M',
        requested_grade_id: null,
        submitted_at: '2026-09-01T09:00:00Z',
        decision_at: null,
        converted_learner_id: null,
        created_at: '2026-09-01T09:00:00Z',
      },
    ]),
  );

  await page.goto('/parent/dashboard');
  await expect(page.getByRole('heading', { name: 'Homework to do' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spelling list' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your applications' })).toBeVisible();
  await expect(page.getByText('APP-2026-00007')).toBeVisible();
  await expect(page.getByText('Under review')).toBeVisible();

  await page.goto(`/parent/children/${LEARNER_ID}`);
  await page.getByRole('button', { name: 'Homework', exact: true }).click();
  await expect(page.getByRole('link', { name: /Spelling list/ })).toBeVisible();
});
