import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockSubjectRow,
  buildMockTimetableEntryRow,
  installDataMocks,
  installAcademicListMock,
} from './utils/mockData';

test('principal can view the weekly timetable', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'timetable_entries', [buildMockTimetableEntryRow()]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/timetable');
  await expect(page.getByRole('heading', { name: 'Timetable' })).toBeVisible();
  const lessonChip = page.getByRole('button', { name: /Mathematics/ });
  await expect(lessonChip).toBeVisible();
  await expect(lessonChip).toContainText('Grade 8A');
  await expect(lessonChip).toContainText('Room 1');
});

test('principal can create a timetable entry', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'timetable_entries', []);

  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('limit')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });
  await page.route('**/rest/v1/timetable_entries*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockTimetableEntryRow({ id: 'timetable-entry-2' }));
  });

  await page.goto('/timetable');
  await page.getByRole('button', { name: 'Add lesson' }).click();
  await page.getByLabel('Class', { exact: true }).selectOption({ label: 'Grade 8A' });
  await page.getByLabel('Subject', { exact: true }).selectOption({ label: 'Mathematics' });
  await page.getByLabel('Search teacher').fill('Naledi');
  await page.getByRole('button', { name: /Naledi Teacher/ }).click();
  await page.getByLabel('Start time').fill('08:00');
  await page.getByLabel('End time').fill('09:00');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add lesson' })).toHaveCount(0);
});

test('a teacher can view but not manage the timetable', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'timetable_entries', [buildMockTimetableEntryRow()]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/timetable');
  await expect(page.getByRole('heading', { name: 'Timetable' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mathematics/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add lesson' })).toHaveCount(0);
});

test('a role without timetable.view is blocked from the timetable', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });

  await page.goto('/timetable');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
});
