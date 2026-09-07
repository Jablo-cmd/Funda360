import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockAcademicYearRow,
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
} from './utils/mockData';

test('a teacher sees their day on the workspace', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher', firstName: 'Thandi' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-1', isActive: true })],
  });

  await page.route('**/rest/v1/class_teacher_assignments*', async (route) =>
    fulfillJson(route, [
      { class_id: 'class-1', subject_id: 'subject-1', active: true, classes: { name: 'Grade 8A' }, subjects: { name: 'Mathematics' } },
    ]),
  );
  await page.route('**/rest/v1/timetable_entries*', async (route) =>
    fulfillJson(route, [
      {
        id: 'lesson-1',
        class_id: 'class-1',
        start_time: '08:00:00',
        end_time: '08:45:00',
        room: 'B12',
        day_of_week: 'monday',
        status: 'published',
        teacher_profile_id: '11111111-1111-1111-1111-111111111111',
        classes: { name: 'Grade 8A' },
        subjects: { name: 'Mathematics' },
      },
    ]),
  );
  await page.route('**/rest/v1/attendance_records*', async (route) => fulfillJson(route, []));
  await page.route('**/rest/v1/assessments*', async (route) =>
    fulfillJson(route, [
      { id: 'assess-1', title: 'Term test', assessment_date: '2026-09-30', class_id: 'class-1', active: true, classes: { name: 'Grade 8A' }, subjects: { name: 'Mathematics' } },
    ]),
  );
  await page.route('**/rest/v1/assignments*', async (route) =>
    fulfillJson(route, [
      { id: 'hw-1', title: 'Fractions', due_at: '2026-09-15T12:00:00Z', status: 'published', class_id: 'class-1', classes: { name: 'Grade 8A' } },
    ]),
  );
  await page.route('**/rest/v1/assignment_submissions*', async (route) =>
    fulfillJson(route, [
      { assignment_id: 'hw-1', status: 'submitted' },
      { assignment_id: 'hw-1', status: 'late' },
    ]),
  );
  await page.route('**/rest/v1/notifications*', async (route) => fulfillJson(route, []));

  await page.goto('/my-classes');
  await expect(page.getByRole('heading', { name: 'Good day, Thandi' })).toBeVisible();
  await expect(page.getByText('08:00–08:45 · Grade 8A')).toBeVisible();
  await expect(page.getByText('Grade 8A — register not taken')).toBeVisible();
  await expect(page.getByText('Term test')).toBeVisible();
  await expect(page.getByRole('link', { name: /Fractions/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Take attendance' })).toBeVisible();
});
