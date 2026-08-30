import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockLearnerRow,
  installDataMocks,
  installLearnerDetailMock,
} from './utils/mockData';

const INCIDENT_ROW = {
  id: 'incident-1',
  learner_id: 'learner-1',
  academic_year_id: 'year-2026',
  incident_type: 'negative',
  severity: 'low',
  category: 'Uniform',
  occurred_at: '2026-02-01T09:00:00Z',
  description: 'Uniform not compliant.',
  action_taken: 'Verbal reminder given.',
  outcome: null,
  follow_up_required: false,
  follow_up_notes: null,
  guardian_visible: false,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-02-01T09:00:00Z',
  updated_at: '2026-02-01T09:00:00Z',
};

test("a principal can record a behaviour incident and flag it visible to the parent portal", async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  const school = buildMockSchoolRow();
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school,
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  let created: Record<string, unknown> | null = null;
  await page.route('**/rest/v1/behaviour_incidents*', async (route) => {
    if (route.request().method() === 'POST') {
      created = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, { ...INCIDENT_ROW, school_id: school.id, guardian_visible: created.guardian_visible });
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, created ? [{ ...INCIDENT_ROW, school_id: school.id, guardian_visible: created.guardian_visible }] : []);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Behaviour', exact: true }).click();
  await page.getByRole('button', { name: 'Record incident' }).click();

  await page.getByLabel('Description').fill('Recognised for helping a classmate.');
  await page.getByLabel('Date and time').fill('2026-02-10T09:00');
  await page.getByLabel('Visible to the parent portal').check();
  await page.getByLabel('Record behaviour incident').getByRole('button', { name: 'Record incident' }).click();

  await expect(page.getByRole('heading', { name: 'Record behaviour incident' })).toHaveCount(0);
  expect(created).not.toBeNull();
  expect(created!.guardian_visible).toBe(true);
  await expect(page.getByText('Visible to parent portal')).toBeVisible();
});

test('a principal can toggle an existing incident\'s parent portal visibility', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  const school = buildMockSchoolRow();
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school,
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  let guardianVisible = false;
  await page.route('**/rest/v1/behaviour_incidents*', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      guardianVisible = Boolean(body.guardian_visible);
      await fulfillJson(route, { ...INCIDENT_ROW, school_id: school.id, guardian_visible: guardianVisible });
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [{ ...INCIDENT_ROW, school_id: school.id, guardian_visible: guardianVisible }]);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Behaviour', exact: true }).click();
  await expect(page.getByText('Visible to parent portal')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show in parent portal' }).click();
  await expect(page.getByText('Visible to parent portal')).toBeVisible();
  expect(guardianVisible).toBe(true);
});

test("a guardian sees only guardian_visible behaviour incidents on the child profile, with staff-only fields never present", async ({
  page,
}) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }));
  await page.route('**/rest/v1/learner_enrollments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/grades*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/classes*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/class_teacher_assignments*', async (route) => fulfillJson(route, []));

  await page.route('**/rest/v1/rpc/get_guardian_visible_behaviour_incidents', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, [
      {
        id: 'incident-2',
        learner_id: 'learner-1',
        incident_type: 'positive',
        severity: null,
        category: 'Leadership',
        occurred_at: '2026-02-05T09:00:00Z',
        description: 'Led the class project.',
        follow_up_required: false,
      },
    ]);
  });

  await page.goto('/parent/children/learner-1');
  await page.getByRole('button', { name: 'Behaviour', exact: true }).click();

  await expect(page.getByText('Led the class project.')).toBeVisible();
  // The RPC's own response never carries action_taken/outcome — nothing
  // staff-only can leak into the DOM because it was never in the payload.
  await expect(page.getByText('Verbal reminder given.')).toHaveCount(0);
});

test('a vice_principal can update a behaviour incident follow-up to resolved', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'vice_principal' });
  const school = buildMockSchoolRow();
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'vice_principal' }),
    school,
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  let incident: Record<string, unknown> = {
    ...INCIDENT_ROW,
    follow_up_required: true,
    follow_up_notes: 'Meet with parent',
    follow_up_status: 'not_started',
    follow_up_assigned_to: null,
    follow_up_target_date: '2026-09-10',
    follow_up_resolved_at: null,
  };
  await page.route('**/rest/v1/behaviour_incidents*', async (route) => {
    if (route.request().method() === 'PATCH') {
      incident = { ...incident, follow_up_status: 'resolved', follow_up_resolved_at: '2026-08-29T00:00:00Z' };
      return fulfillJson(route, incident);
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [incident]);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Behaviour', exact: true }).click();

  await expect(page.getByText('Follow-up: Not started')).toBeVisible();
  await expect(page.getByText(/Target: 10 Sept? 2026/)).toBeVisible();

  await page.getByRole('button', { name: 'Update follow-up' }).click();
  await page.getByLabel('Status').selectOption('resolved');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Update follow-up' })).toHaveCount(0);
});
