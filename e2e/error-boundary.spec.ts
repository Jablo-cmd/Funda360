import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
  installUsersListMock,
} from './utils/mockData';

test('a missing route chunk after a redeploy reloads once, then offers a reload instead of a blank screen', async ({
  page,
}) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'principal' }),
    school: buildMockSchoolRow(),
  });
  await installUsersListMock(page, []);

  let chunkRequests = 0;
  await page.route(/\/assets\/UsersPage-[^/]+\.js$/, async (route) => {
    chunkRequests += 1;
    await route.fulfill({ status: 404, body: 'Not found' });
  });

  await page.goto('/users');
  await expect(
    page.getByRole('heading', { name: 'A new version of Funda360 is available' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  // The app shell (header / navigation) survives: the boundary is per route.
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
  expect(chunkRequests).toBeGreaterThanOrEqual(2);
});
