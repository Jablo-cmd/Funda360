import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, installDataMocks } from './utils/mockData';

test('hr_manager can mark the staff register for a date', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/employees*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('employment_status')) return route.fallback();
    await fulfillJson(route, [
      { id: 'employee-1', first_name: 'Karabo', last_name: 'Mokoena', employee_number: 'EMP-0001' },
    ]);
  });
  await page.route('**/rest/v1/staff_attendance_records*', async (route) => {
    if (route.request().method() === 'POST') {
      return fulfillJson(route, [{ id: 'sar-1', employee_id: 'employee-1', attendance_date: '2026-08-29', status: 'late' }]);
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/employees/attendance');
  await expect(page.getByRole('heading', { name: 'Staff Attendance' })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table.getByText('Karabo Mokoena')).toBeVisible();

  await page.locator('tr', { hasText: 'Karabo Mokoena' }).getByRole('button', { name: 'Late' }).click();
  await page.getByRole('button', { name: 'Save register' }).click();

  await expect(page.getByText('Register saved.')).toBeVisible();
});

test('a teacher without employee.view cannot reach staff attendance', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/employees/attendance');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Staff Attendance' })).toHaveCount(0);
});

test('principal can view but not mark the staff register', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/employees*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('employment_status')) return route.fallback();
    await fulfillJson(route, [
      { id: 'employee-1', first_name: 'Karabo', last_name: 'Mokoena', employee_number: 'EMP-0001' },
    ]);
  });
  await page.route('**/rest/v1/staff_attendance_records*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/employees/attendance');
  await expect(page.getByRole('table').getByText('Karabo Mokoena')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save register' })).toHaveCount(0);
});
