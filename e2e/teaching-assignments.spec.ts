import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockSubjectRow,
  buildMockClassTeacherAssignmentRow,
  installDataMocks,
  installAcademicListMock,
  installEmployeeDetailMock,
  installReportRowsMock,
} from './utils/mockData';

test('principal can view teaching assignments', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', [
    buildMockClassTeacherAssignmentRow({ teacherProfileId: '11111111-1111-1111-1111-111111111111' }),
  ]);
  // Only intercept the getTeacherCandidatesByIds `.in('id', [...])` lookup —
  // its `id` filter value is prefixed `in.`, unlike ProfileProvider's own
  // `.eq('id', userId)` fetch (`eq.` prefix), which must fall through to
  // installDataMocks' real profile mock.
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: '11111111-1111-1111-1111-111111111111', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/academic/teaching-assignments');
  await expect(page.getByRole('heading', { name: 'Teaching Assignments' })).toBeVisible();
  await expect(page.getByText('Naledi Teacher')).toBeVisible();
  await expect(page.getByText('Grade 8A')).toBeVisible();
});

test('principal can create a teaching assignment', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', []);

  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('limit')) return route.fallback();
    await fulfillJson(route, [
      { id: '11111111-1111-1111-1111-111111111111', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });
  await page.route('**/rest/v1/class_teacher_assignments*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockClassTeacherAssignmentRow({ id: 'assignment-2', teacherProfileId: '11111111-1111-1111-1111-111111111111' }));
  });

  await page.goto('/academic/teaching-assignments');
  await page.getByRole('button', { name: 'Add assignment' }).click();
  await page.getByLabel('Search teacher').fill('Naledi');
  await page.getByRole('button', { name: /Naledi Teacher/ }).click();
  await page.getByLabel('Class').selectOption({ label: 'Grade 8A' });
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add teaching assignment' })).toHaveCount(0);
});

test('teacher can view but not manage teaching assignments', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', [
    buildMockClassTeacherAssignmentRow({ teacherProfileId: '11111111-1111-1111-1111-111111111111' }),
  ]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: '11111111-1111-1111-1111-111111111111', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/academic/teaching-assignments');
  await expect(page.getByRole('heading', { name: 'Teaching Assignments' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add assignment' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
});

test('a role without academic.view is blocked from teaching assignments', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });

  await page.goto('/academic/teaching-assignments');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
});

test('a teacher sees their assigned classes on My Profile', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', [buildMockClassTeacherAssignmentRow()]);
  await installEmployeeDetailMock(page, null);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'My Classes' })).toBeVisible();
  await expect(page.getByText('Grade 8A')).toBeVisible();
  await expect(page.getByText('Class teacher')).toBeVisible();
});
