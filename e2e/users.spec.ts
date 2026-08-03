import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
  installRpcMock,
  installUsersListMock,
} from './utils/mockData';

const TEACHER_ID = '44444444-4444-4444-4444-444444444444';

test('admin can view the users directory', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installUsersListMock(page, [
    buildMockProfileRow(),
    buildMockProfileRow({ id: TEACHER_ID, firstName: 'Zola', lastName: 'Teacher', email: 'zola@riverside.test', role: 'teacher' }),
  ]);

  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ada Principal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zola Teacher' })).toBeVisible();
  await expect(page.getByText('Showing 1–2 of 2')).toBeVisible();
});

test('admin can create a user and sees a one-time temporary password', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installUsersListMock(page, [buildMockProfileRow()]);
  await installRpcMock(page, 'admin_create_user', (route) =>
    fulfillJson(route, [{ user_id: '66666666-6666-6666-6666-666666666666', temporary_password: 'Tmp9xQ2vLkZo1==' }]),
  );

  await page.goto('/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.getByLabel('First name').fill('New');
  await page.getByLabel('Last name').fill('Teacher');
  await page.getByLabel('Email').fill('new.teacher@riverside.test');
  await page.locator('#create-user-role').selectOption('teacher');
  await page.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByRole('status')).toHaveText('The account was created successfully.');
  await expect(page.getByText('Tmp9xQ2vLkZo1==')).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Add user' })).toHaveCount(0);
});

test('admin can edit a user', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installUsersListMock(page, [
    buildMockProfileRow({ id: TEACHER_ID, firstName: 'Zola', lastName: 'Teacher', email: 'zola@riverside.test', role: 'teacher' }),
  ]);
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    await fulfillJson(route, buildMockProfileRow({ id: TEACHER_ID, firstName: 'Zolani', lastName: 'Teacher', role: 'teacher' }));
  });

  await page.goto('/users');
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit user' })).toBeVisible();

  await page.getByLabel('First name').fill('Zolani');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('heading', { name: 'Edit user' })).toHaveCount(0);
});

test('admin can assign a role to a teacher', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installUsersListMock(page, [
    buildMockProfileRow({ id: TEACHER_ID, firstName: 'Zola', lastName: 'Teacher', email: 'zola@riverside.test', role: 'teacher' }),
  ]);
  await installRpcMock(page, 'admin_update_user_role', (route) => fulfillJson(route, null));

  await page.goto('/users');
  await page.getByRole('button', { name: 'Change role' }).click();
  await expect(page.getByRole('heading', { name: 'Change role' })).toBeVisible();
  await expect(page.locator('#change-role-select')).toHaveValue('teacher');

  await page.getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('heading', { name: 'Change role' })).toHaveCount(0);
});

test('editing a user never sends tenant_id in the update payload', async ({ page }) => {
  // Regression guard for the profiles.tenant_id self-service escalation
  // fix (see supabase/migrations/20260803140000_prevent_direct_tenant_change.sql).
  // The real protection is the DB-side trigger (verified in the RLS
  // harness, supabase/rls-tests/), which blocks this even if the app ever
  // did send it — this test exists so a future change to the edit-user
  // form that starts sending tenant_id fails fast in CI, long before it
  // would reach that trigger in production.
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installUsersListMock(page, [
    buildMockProfileRow({ id: TEACHER_ID, firstName: 'Zola', lastName: 'Teacher', email: 'zola@riverside.test', role: 'teacher' }),
  ]);

  let patchBody: unknown;
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    patchBody = route.request().postDataJSON();
    await fulfillJson(route, buildMockProfileRow({ id: TEACHER_ID, firstName: 'Zolani', lastName: 'Teacher', role: 'teacher' }));
  });

  await page.goto('/users');
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('First name').fill('Zolani');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('heading', { name: 'Edit user' })).toHaveCount(0);
  expect(patchBody).not.toHaveProperty('tenant_id');
});

test('a role without profile.view_any is blocked from the users directory', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
  });

  await page.goto('/users');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
});

test('tenant isolation: a user outside the caller\'s tenant cannot be viewed', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  // RLS scopes profile reads to the caller's own tenant — a cross-tenant id
  // resolves to no row at all, which the client surfaces as "not found"
  // rather than leaking whether the id exists in another school.
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('id')?.includes('99999999')) {
      return fulfillJson(route, null);
    }
    return route.fallback();
  });

  await page.goto('/users/99999999-9999-9999-9999-999999999999');
  await expect(page.getByRole('heading', { name: 'User not found' })).toBeVisible();
});
