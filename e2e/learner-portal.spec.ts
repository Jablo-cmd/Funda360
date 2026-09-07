import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockLearnerRow, buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

const LEARNER_ID = 'learner-self-1';

function learnerRow() {
  return buildMockLearnerRow({ id: LEARNER_ID, firstName: 'Thabo', lastName: 'N' });
}

function assignmentRow() {
  return {
    id: 'hw-1',
    school_id: 'tenant-demo',
    academic_year_id: 'y1',
    term_id: null,
    class_id: 'c1',
    subject_id: 's1',
    assessment_id: null,
    title: 'Read chapter 4',
    instructions: 'Answer the questions at the end.',
    due_at: '2026-09-25T12:00:00Z',
    max_points: null,
    allow_resubmission: false,
    status: 'published',
    rubric: [],
    published_at: '2026-09-08T09:00:00Z',
    closed_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-09-08T09:00:00Z',
    classes: { name: 'Grade 6A' },
    subjects: { name: 'English' },
  };
}

test('a learner is redirected from the staff dashboard to their portal', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'learner' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'learner', firstName: 'Thabo' }), school: buildMockSchoolRow() });
  await page.route('**/rest/v1/learners*', async (route) => fulfillJson(route, route.request().url().includes('profile_id') ? learnerRow() : [learnerRow()]));
  await page.route('**/rest/v1/assignment_submissions*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/notifications*', async (route) => fulfillJson(route, []));

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/learner\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Hi, Thabo' })).toBeVisible();
});

test('a learner submits their homework', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'learner' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'learner', firstName: 'Thabo' }), school: buildMockSchoolRow() });

  let submissionStatus = 'assigned';
  await page.route('**/rest/v1/learners*', async (route) => fulfillJson(route, route.request().url().includes('profile_id') ? learnerRow() : [learnerRow()]));
  await page.route('**/rest/v1/notifications*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/assignment_submissions*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, [
      {
        id: 'sub-1',
        assignment_id: 'hw-1',
        learner_id: LEARNER_ID,
        status: submissionStatus,
        submission_text: null,
        submitted_at: null,
        is_late: false,
        attempt_count: 0,
        points_awarded: null,
        rubric_scores: {},
        teacher_feedback: null,
        marked_at: null,
        returned_at: null,
        learners: { first_name: 'Thabo', last_name: 'N' },
        assignments: assignmentRow(),
      },
    ]);
  });
  await page.route('**/rest/v1/rpc/submit_assignment', async (route) => {
    submissionStatus = 'submitted';
    return fulfillJson(route, { id: 'sub-1', assignment_id: 'hw-1', learner_id: LEARNER_ID, status: 'submitted', submission_text: 'done', submitted_at: '2026-09-10T10:00:00Z', is_late: false, attempt_count: 1, points_awarded: null, rubric_scores: {}, teacher_feedback: null, marked_at: null, returned_at: null });
  });

  await page.goto('/learner/homework');
  await expect(page.getByRole('heading', { name: 'Homework' })).toBeVisible();
  await page.getByRole('button', { name: /Read chapter 4/ }).click();
  await expect(page.getByText('Answer the questions at the end.')).toBeVisible();
  await page.getByLabel('Your submission').fill('Here are my answers.');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Status: Submitted')).toBeVisible();
});

test('staff can provision a learner login', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school: buildMockSchoolRow(),
  });
  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, buildMockLearnerRow({ id: LEARNER_ID, firstName: 'Thabo', lastName: 'N' }));
  });
  // keep the rest of the learner profile page's queries quiet
  await page.route('**/rest/v1/learner_enrollments*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/learner_guardians*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/learner_fee_charges*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/behaviour_incidents*', async (route) => fulfillJson(route, []));
  let provisioned = false;
  await page.route('**/rest/v1/rpc/provision_learner_login', async (route) => {
    provisioned = true;
    return fulfillJson(route, [{ user_id: 'new-user', temporary_password: 'Temp-Pass-123' }]);
  });

  await page.goto(`/learners/${LEARNER_ID}`);
  await page.getByRole('button', { name: 'Provision login' }).click();
  await page.getByLabel('Email').fill('thabo.n@school.test');
  await page.getByRole('button', { name: 'Provision login' }).nth(1).click();
  await expect(page.getByText('Temp-Pass-123')).toBeVisible();
  expect(provisioned).toBe(true);
});
