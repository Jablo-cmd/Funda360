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

test('a draft lesson is visually marked and offers a publish action to a manager', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  await installAcademicListMock(page, 'timetable_entries', [
    buildMockTimetableEntryRow({ id: 'timetable-entry-1', status: 'published' }),
    buildMockTimetableEntryRow({ id: 'timetable-entry-2', dayOfWeek: 'tuesday', status: 'draft' }),
  ]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/timetable');
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish 1 draft lesson' })).toBeVisible();
});

test('publishing draft lessons clears them from the draft count', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  let entries = [buildMockTimetableEntryRow({ id: 'timetable-entry-2', dayOfWeek: 'tuesday', status: 'draft' })];
  await page.route('**/rest/v1/timetable_entries*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'PATCH' && url.searchParams.get('status') === 'eq.draft') {
      entries = entries.map((entry) => ({ ...entry, status: 'published' }));
      return fulfillJson(route, entries);
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, entries);
  });
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/timetable');
  await expect(page.getByRole('button', { name: 'Publish 1 draft lesson' })).toBeVisible();
  await page.getByRole('button', { name: 'Publish 1 draft lesson' }).click();

  await expect(page.getByRole('button', { name: /Publish \d+ draft lesson/ })).toHaveCount(0);
  await expect(page.getByText('Draft', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Published 1 draft lesson.')).toBeVisible();
});

test('principal can assign and cancel a substitute teacher for a lesson', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  // The default mock entry is a Monday lesson; 2026-08-31 is a real Monday.
  await installAcademicListMock(page, 'timetable_entries', [buildMockTimetableEntryRow({ dayOfWeek: 'monday' })]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') return route.fallback();
    if (!url.searchParams.has('limit') && !url.searchParams.get('id')?.startsWith('in.')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
      { id: 'teacher-2', first_name: 'Sipho', last_name: 'Cover', email: 'sipho@riverside.funda360.dev' },
    ]);
  });

  let substitutions: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/timetable_substitutions*', async (route) => {
    if (route.request().method() === 'POST') {
      const body = { id: 'sub-1', school_id: 'tenant-demo', substitute_date: '2026-08-31', substitute_teacher_profile_id: 'teacher-2', reason: 'Sick leave', notes: null, timetable_entry_id: 'timetable-entry-1', created_at: '2026-01-01T00:00:00Z' };
      substitutions = [body];
      return fulfillJson(route, body);
    }
    if (route.request().method() === 'DELETE') {
      substitutions = [];
      return fulfillJson(route, {});
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, substitutions);
  });

  await page.goto('/timetable');
  await page.getByRole('button', { name: /Mathematics/ }).click();
  await page.getByRole('button', { name: 'Assign substitute…' }).click();

  await page.getByLabel('Substitute date').fill('2026-08-31');
  await page.getByLabel('Search substitute teacher').fill('Sipho');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Sipho Cover/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Assign substitute' }).click();

  await expect(page.getByRole('heading', { name: 'Assign substitute teacher' })).toHaveCount(0);
  await expect(page.getByText('Substitute teachers')).toBeVisible();
  await expect(page.getByText(/Covered by Sipho Cover/)).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Substitute teachers')).toHaveCount(0);
});

test('the create-lesson form suggests available slots once class and teacher are picked', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'subjects', [buildMockSubjectRow()]);
  // Establishes the school's known 08:00-09:00 period via an unrelated
  // class/teacher, so it never conflicts with the new entry being planned.
  await installAcademicListMock(page, 'timetable_entries', [
    buildMockTimetableEntryRow({ classId: 'class-9a', teacherProfileId: 'teacher-9', dayOfWeek: 'tuesday' }),
  ]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('limit')) return route.fallback();
    await fulfillJson(route, [
      { id: 'teacher-1', first_name: 'Naledi', last_name: 'Teacher', email: 'naledi@riverside.funda360.dev' },
    ]);
  });

  await page.goto('/timetable');
  await page.getByRole('button', { name: 'Add lesson' }).click();
  await expect(page.getByText('Suggested available slots')).toHaveCount(0);

  await page.getByLabel('Class', { exact: true }).selectOption({ label: 'Grade 8A' });
  await page.getByLabel('Search teacher').fill('Naledi');
  await page.getByRole('button', { name: /Naledi Teacher/ }).click();

  await expect(page.getByText('Suggested available slots')).toBeVisible();
  const suggestion = page.getByRole('button', { name: /08:00–09:00/ }).first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  await expect(page.getByLabel('Start time')).toHaveValue('08:00');
  await expect(page.getByLabel('End time')).toHaveValue('09:00');
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
