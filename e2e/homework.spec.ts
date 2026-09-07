import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockAcademicYearRow,
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
} from './utils/mockData';

const CLASS_ID = 'class-1';
const SUBJECT_ID = 'subject-1';
const ASSIGNMENT_ID = 'assignment-1';
const LEARNER_ID = 'learner-1';

function assignmentRow(status: string) {
  return {
    id: ASSIGNMENT_ID,
    school_id: 'tenant-demo',
    academic_year_id: 'year-1',
    term_id: null,
    class_id: CLASS_ID,
    subject_id: SUBJECT_ID,
    assessment_id: null,
    title: 'Fractions worksheet',
    instructions: 'Do questions 1-10.',
    due_at: '2026-09-20T12:00:00Z',
    max_points: 10,
    allow_resubmission: false,
    status,
    rubric: [],
    published_at: status === 'draft' ? null : '2026-09-08T09:00:00Z',
    closed_at: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-09-08T09:00:00Z',
    classes: { name: 'Grade 8A' },
    subjects: { name: 'Mathematics' },
  };
}

function submissionRow(status: string, points: number | null = null) {
  return {
    id: 'submission-1',
    assignment_id: ASSIGNMENT_ID,
    learner_id: LEARNER_ID,
    status,
    submission_text: status === 'assigned' ? null : 'My answers',
    submitted_at: status === 'assigned' ? null : '2026-09-10T08:00:00Z',
    is_late: false,
    attempt_count: status === 'assigned' ? 0 : 1,
    points_awarded: points,
    rubric_scores: {},
    teacher_feedback: null,
    marked_at: null,
    returned_at: null,
    learners: { first_name: 'Lerato', last_name: 'M' },
  };
}

test('a teacher creates, publishes and marks an assignment', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-1', isActive: true })],
  });

  let status = 'none';
  let submissionStatus = 'assigned';

  await page.route('**/rest/v1/classes*', async (route) => fulfillJson(route, [{ id: CLASS_ID, grade_id: 'g1', school_id: 'tenant-demo', name: 'Grade 8A', capacity: 30, active: true, created_at: '', updated_at: '' }]));
  await page.route('**/rest/v1/subjects*', async (route) => fulfillJson(route, [{ id: SUBJECT_ID, school_id: 'tenant-demo', name: 'Mathematics', code: null, description: null, active: true, created_at: '', updated_at: '' }]));
  await page.route('**/rest/v1/assignments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    if (url.searchParams.has('id')) {
      return fulfillJson(route, assignmentRow(status === 'none' ? 'draft' : status));
    }
    return fulfillJson(route, status === 'none' ? [] : [assignmentRow(status)]);
  });
  await page.route('**/rest/v1/assignment_resources*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/assignment_submissions*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, status === 'published' ? [submissionRow(submissionStatus, submissionStatus === 'reviewed' ? 8 : null)] : []);
  });
  await page.route('**/rest/v1/rpc/create_assignment', async (route) => {
    status = 'draft';
    return fulfillJson(route, assignmentRow('draft'));
  });
  await page.route('**/rest/v1/rpc/publish_assignment', async (route) => {
    status = 'published';
    submissionStatus = 'submitted';
    return fulfillJson(route, assignmentRow('published'));
  });
  await page.route('**/rest/v1/rpc/mark_assignment_submission', async (route) => {
    submissionStatus = 'reviewed';
    return fulfillJson(route, submissionRow('reviewed', 8));
  });

  await page.goto('/homework');
  await expect(page.getByRole('heading', { name: 'Homework' })).toBeVisible();
  await expect(page.getByText('No assignments yet.')).toBeVisible();

  await page.getByRole('button', { name: 'New assignment' }).click();
  await page.getByRole('dialog').getByLabel('Class').selectOption('Grade 8A');
  await page.getByRole('dialog').getByLabel('Subject').selectOption('Mathematics');
  await page.getByLabel('Title').fill('Fractions worksheet');
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page.getByRole('heading', { name: 'Fractions worksheet' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Lerato M')).toBeVisible();

  await page.getByRole('button', { name: 'Mark', exact: true }).click();
  await page.getByLabel(/Points/).fill('8');
  await page.getByRole('button', { name: 'Mark as done' }).click();
  await expect(page.getByText('8 / 10')).toBeVisible();
});

test('a guardian submits their child\'s homework', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });

  let submissionStatus = 'assigned';

  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, [{ id: LEARNER_ID, school_id: 'tenant-demo', first_name: 'Lerato', last_name: 'M', learner_number: 'LRN-1', admission_number: 'ADM-1', date_of_birth: '2014-01-01', status: 'active', admission_date: '2024-01-01' }]);
  });
  await page.route('**/rest/v1/learner_guardians*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/assignment_submissions*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return fulfillJson(route, [{ ...submissionRow(submissionStatus), assignments: assignmentRow('published') }]);
  });
  await page.route('**/rest/v1/rpc/submit_assignment', async (route) => {
    submissionStatus = 'submitted';
    return fulfillJson(route, submissionRow('submitted'));
  });

  await page.goto('/parent/homework');
  await expect(page.getByRole('heading', { name: 'Homework' })).toBeVisible();
  await page.getByRole('button', { name: /Fractions worksheet/ }).click();

  await expect(page.getByText('Do questions 1-10.')).toBeVisible();
  await page.getByLabel('Your submission').fill('Here are my answers.');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Status: Submitted')).toBeVisible();
});
