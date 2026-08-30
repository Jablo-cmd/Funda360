import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockLearnerRow,
  buildMockLearnerEnrollmentRow,
  buildMockGradeRow,
  buildMockClassRow,
  installDataMocks,
  installLearnerDetailMock,
  installLearnerChildListMock,
  installAcademicListMock,
} from './utils/mockData';

test('principal can record and update a safeguarding concern on a learner profile', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  let concerns: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/safeguarding_concerns*', async (route) => {
    if (route.request().method() === 'POST') {
      const created = {
        id: 'concern-1', learner_id: 'learner-1', category: 'Online safety', description: 'Reported by a teacher',
        severity: 'high', status: 'open', action_taken: null, confidential_notes: null, resolved_at: null,
        created_at: '2026-08-29T00:00:00Z', updated_at: '2026-08-29T00:00:00Z',
      };
      concerns = [created];
      return fulfillJson(route, created);
    }
    if (route.request().method() === 'PATCH') {
      concerns = concerns.map((c) => ({ ...c, status: 'resolved' }));
      return fulfillJson(route, concerns[0]);
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, concerns);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Safeguarding' }).click();
  await expect(page.getByText('Confidential — visible only to the school owner and principal.')).toBeVisible();
  await expect(page.getByText('No safeguarding concerns recorded for this learner.')).toBeVisible();

  await page.getByRole('button', { name: 'Record concern' }).click();
  await page.getByLabel('Category (optional)').fill('Online safety');
  await page.getByLabel('Severity').selectOption('high');
  await page.getByLabel('Description').fill('Reported by a teacher');
  await page.getByRole('button', { name: 'Record concern' }).nth(1).click();

  await expect(page.getByRole('heading', { name: 'Record safeguarding concern' })).toHaveCount(0);
  await expect(page.getByText('Reported by a teacher')).toBeVisible();

  await page.getByRole('button', { name: 'Update' }).click();
  await page.getByLabel('Status').selectOption('resolved');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Update safeguarding concern' })).toHaveCount(0);
});

test('a teacher never sees the Safeguarding tab on a learner profile', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  await page.goto('/learners/learner-1');
  await expect(page.getByRole('button', { name: 'Safeguarding' })).toHaveCount(0);
});

test('a vice_principal never sees the Safeguarding tab, despite having behaviour access', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'vice_principal' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'vice_principal' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', []);

  await page.goto('/learners/learner-1');
  await expect(page.getByRole('button', { name: 'Behaviour', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Safeguarding' })).toHaveCount(0);
});

test('a guardian never sees anything safeguarding-related on their child profile', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }));
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow()]);
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installLearnerChildListMock(page, 'learner_emergency_contacts', []);

  await page.goto('/parent/children/learner-1');
  await expect(page.getByRole('heading', { name: 'Naledi Dube', level: 1 })).toBeVisible();
  await expect(page.getByText('Safeguarding')).toHaveCount(0);
});

test('principal can view the school-wide safeguarding overview; a teacher is blocked', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await page.route('**/rest/v1/safeguarding_concerns*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/safeguarding');
  await expect(page.getByRole('heading', { name: 'Safeguarding' })).toBeVisible();
  await expect(page.getByText('No active safeguarding concerns.')).toBeVisible();
});

test('a role without learner.view_safeguarding is blocked from /safeguarding', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/safeguarding');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Safeguarding' })).toHaveCount(0);
});
