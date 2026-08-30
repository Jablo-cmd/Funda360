import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession, MOCK_USER_ID } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, buildMockAcademicYearRow, installDataMocks } from './utils/mockData';

function buildNotificationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notification-1',
    school_id: 'tenant-demo',
    recipient_profile_id: MOCK_USER_ID,
    type: 'guardian_invitation',
    title: 'Activate your Funda360 account',
    body: "You've been invited to access the Parent Portal.",
    related_entity_table: 'guardian_invitations',
    related_entity_id: 'invitation-1',
    link_path: '/activate-account',
    email_status: 'not_sent',
    read_at: null,
    created_at: '2026-08-01T09:00:00Z',
    ...overrides,
  };
}

test('the header bell shows an unread badge and links to the notifications list', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await page.route('**/rest/v1/notifications*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [buildNotificationRow(), buildNotificationRow({ id: 'notification-2', title: 'Second one', read_at: '2026-08-02T09:00:00Z' })]);
  });

  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: /Notifications, 1 unread/ })).toBeVisible();

  await page.getByRole('link', { name: /Notifications/ }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('Activate your Funda360 account')).toBeVisible();
  await expect(page.getByText('Second one')).toBeVisible();
});

test('opening an unread notification marks it read and navigates to its link_path', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  let markedRead = false;
  await page.route('**/rest/v1/notifications*', async (route) => {
    if (route.request().method() === 'PATCH') {
      markedRead = true;
      await fulfillJson(route, buildNotificationRow({ read_at: '2026-08-03T09:00:00Z' }));
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, markedRead ? [buildNotificationRow({ read_at: '2026-08-03T09:00:00Z' })] : [buildNotificationRow()]);
  });

  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByText('Activate your Funda360 account').click();

  await expect(page).toHaveURL('http://localhost:5173/activate-account');
});

test('"Mark all as read" clears every unread notification in one action', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  let markedAll = false;
  await page.route('**/rest/v1/notifications*', async (route) => {
    if (route.request().method() === 'PATCH') {
      markedAll = true;
      await fulfillJson(route, []);
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(
      route,
      markedAll
        ? [
            buildNotificationRow({ read_at: '2026-08-03T09:00:00Z' }),
            buildNotificationRow({ id: 'notification-2', title: 'Second one', read_at: '2026-08-03T09:00:00Z' }),
          ]
        : [buildNotificationRow(), buildNotificationRow({ id: 'notification-2', title: 'Second one' })],
    );
  });

  await page.goto('/notifications');
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();

  // markAllRead() is an async click handler — click() only waits for the
  // DOM event to dispatch, not for the PATCH request it kicks off. Assert
  // on the retrying UI expectation first (which only passes once the
  // resulting re-render has actually happened) so markedAll is read after
  // the real async work is guaranteed done, not raced against it.
  await expect(page.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0);
  expect(markedAll).toBe(true);
});

test('a user with no notifications sees an empty state, not an error', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await page.route('**/rest/v1/notifications*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText(/\d\+? unread/)).toHaveCount(0);

  await page.goto('/notifications');
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
});
