import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, installDataMocks } from './utils/mockData';

test('hr_manager can review and approve a pending leave request', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/employees*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('employment_status')) return route.fallback();
    await fulfillJson(route, [{ id: 'employee-1', first_name: 'Karabo', last_name: 'Mokoena', employee_number: 'EMP-0001' }]);
  });

  let requestStatus = 'pending';
  await page.route('**/rest/v1/leave_requests*', async (route) => {
    if (route.request().method() === 'PATCH') {
      requestStatus = 'approved';
      return fulfillJson(route, {
        id: 'leave-1', employee_id: 'employee-1', leave_type: 'annual', start_date: '2026-09-14', end_date: '2026-09-16',
        reason: 'Family trip', status: 'approved', reviewed_by: 'hr-manager-1', reviewed_at: '2026-08-29T00:00:00Z', review_notes: 'Enjoy!', created_at: '2026-08-01T00:00:00Z',
      });
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [
      {
        id: 'leave-1', employee_id: 'employee-1', leave_type: 'annual', start_date: '2026-09-14', end_date: '2026-09-16',
        reason: 'Family trip', status: requestStatus, reviewed_by: null, reviewed_at: null, review_notes: null, created_at: '2026-08-01T00:00:00Z',
      },
    ]);
  });

  await page.goto('/employees/leave');
  await expect(page.getByRole('heading', { name: 'Leave Requests' })).toBeVisible();
  await expect(page.getByText('Karabo Mokoena')).toBeVisible();
  await expect(page.getByText('Family trip')).toBeVisible();

  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByLabel('Notes (optional)').fill('Enjoy!');
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByRole('heading', { name: 'Review leave request' })).toHaveCount(0);
});

test('principal can view leave requests but has no review action', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/employees*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !url.searchParams.has('employment_status')) return route.fallback();
    await fulfillJson(route, [{ id: 'employee-1', first_name: 'Karabo', last_name: 'Mokoena', employee_number: 'EMP-0001' }]);
  });
  await page.route('**/rest/v1/leave_requests*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [
      {
        id: 'leave-1', employee_id: 'employee-1', leave_type: 'annual', start_date: '2026-09-14', end_date: '2026-09-16',
        reason: 'Family trip', status: 'pending', reviewed_by: null, reviewed_at: null, review_notes: null, created_at: '2026-08-01T00:00:00Z',
      },
    ]);
  });

  await page.goto('/employees/leave');
  await expect(page.getByText('Family trip')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review' })).toHaveCount(0);
});

test('a role without employee.view is blocked from leave requests', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/employees/leave');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Leave Requests' })).toHaveCount(0);
});
