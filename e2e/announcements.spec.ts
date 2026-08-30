import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, buildMockAcademicYearRow, installDataMocks } from './utils/mockData';

const ANNOUNCEMENT_ROW = {
  id: 'announcement-1',
  school_id: 'tenant-demo',
  title: 'Sports day next Friday',
  body: 'All welcome from 08:00.',
  audience: 'everyone',
  active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-08-01T09:00:00Z',
  updated_at: '2026-08-01T09:00:00Z',
};

test('a principal can post an announcement', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  let created = false;
  await page.route('**/rest/v1/announcements*', async (route) => {
    if (route.request().method() === 'POST') {
      created = true;
      await fulfillJson(route, ANNOUNCEMENT_ROW);
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, created ? [ANNOUNCEMENT_ROW] : []);
  });

  await page.goto('/announcements');
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible();
  await expect(page.getByText('No announcements yet.')).toBeVisible();

  await page.getByRole('button', { name: 'Post announcement' }).click();
  await page.getByLabel('Title').fill('Sports day next Friday');
  await page.getByLabel('Message').fill('All welcome from 08:00.');
  await page.getByLabel('Post announcement').getByRole('button', { name: 'Post announcement' }).click();

  await expect(page.getByRole('heading', { name: 'Post announcement' })).toHaveCount(0);
  expect(created).toBe(true);
  await expect(page.getByText('Sports day next Friday')).toBeVisible();
  await expect(page.getByText('All welcome from 08:00.')).toBeVisible();
});

test('a teacher does not see the "Post announcement" button', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await page.route('**/rest/v1/announcements*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [ANNOUNCEMENT_ROW]);
  });

  await page.goto('/announcements');
  await expect(page.getByText('Sports day next Friday')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post announcement' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
});

test('a guardian can view announcements on the Parent Portal, read-only', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await page.route('**/rest/v1/announcements*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [ANNOUNCEMENT_ROW]);
  });

  await page.goto('/parent/announcements');
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible();
  await expect(page.getByText('Sports day next Friday')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post announcement' })).toHaveCount(0);
});
