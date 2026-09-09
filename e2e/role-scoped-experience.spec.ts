import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockAcademicYearRow,
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
} from './utils/mockData';

/**
 * Catch-all so a role-scoped shell test never makes a real network call for
 * a table it doesn't care about — anything installDataMocks already handles
 * (profiles / schools / academic_years) is deferred to it via fallback.
 */
async function stubRemainingRest(page: Parameters<typeof installDataMocks>[0]) {
  await page.route('**/rest/v1/**', async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    if (/\/(profiles|schools|academic_years)$/.test(pathname)) return route.fallback();
    return fulfillJson(route, []);
  });
}

async function signIn(page: Parameters<typeof installDataMocks>[0], role: string) {
  await seedAuthenticatedSession(page, { role: role as 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: role as 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ id: 'year-1', isActive: true })],
  });
  await stubRemainingRest(page);
}

test('the staff shell never renders a "Soon" or disabled placeholder nav item', async ({ page }) => {
  await signIn(page, 'accountant');
  await page.goto('/dashboard');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByText(/\bSoon\b/)).toHaveCount(0);
  await expect(page.getByText('Coming Soon')).toHaveCount(0);
});

test('a teacher sees a teaching-only sidebar', async ({ page }) => {
  await signIn(page, 'teacher');
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Main' });

  for (const item of ['Dashboard', 'Attendance', 'Assessments', 'Homework', 'Report Cards', 'Messages']) {
    await expect(nav.getByRole('link', { name: item, exact: true })).toBeVisible();
  }
  for (const forbidden of ['Finance Overview', 'Invoices', 'Employees', 'Users & Roles', 'Applications', 'Reports']) {
    await expect(nav.getByRole('link', { name: forbidden, exact: true })).toHaveCount(0);
  }
});

test('an accountant sees a finance-only sidebar and dashboard', async ({ page }) => {
  await signIn(page, 'accountant');
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Main' });

  for (const item of ['Finance Overview', 'Invoices', 'Bank Reconciliation']) {
    await expect(nav.getByRole('link', { name: item, exact: true })).toBeVisible();
  }
  for (const forbidden of ['Attendance', 'Assessments', 'Homework', 'Academic Years', 'Employees', 'Applications']) {
    await expect(nav.getByRole('link', { name: forbidden, exact: true })).toHaveCount(0);
  }

  await expect(page.getByText('Outstanding Fees')).toBeVisible();
  await expect(page.getByText(/attendance/i)).toHaveCount(0);
});

test('route guards still block a hidden area on direct navigation', async ({ page }) => {
  await signIn(page, 'accountant');
  await page.goto('/attendance');
  // RequirePermission redirects an accountant (no attendance.view) to /dashboard.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Outstanding Fees')).toBeVisible();
});

test('a role with profile.view_any but not profile.manage_any cannot reach /users by URL', async ({ page }) => {
  // receptionist holds profile.view_any (for applicant/guardian lookups) but
  // not profile.manage_any — the staff directory is not part of its workspace.
  await signIn(page, 'receptionist');
  await page.goto('/users');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Users & Roles' })).toHaveCount(0);
});

test('a principal sees whole-school navigation', async ({ page }) => {
  await signIn(page, 'principal');
  await page.goto('/dashboard');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const item of ['Learners', 'Applications', 'Academic Years', 'Attendance', 'Employees', 'Reports', 'Users & Roles']) {
    await expect(nav.getByRole('link', { name: item, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Executive Summary' })).toBeVisible();
});
