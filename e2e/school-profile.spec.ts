import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockProfileRow,
  buildMockSchoolRow,
  installDataMocks,
  installStorageUploadMock,
} from './utils/mockData';

test('admin can access the school profile page from the sidebar', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'School Profile', exact: true }).click();

  await expect(page).toHaveURL(/\/school\/profile$/);
  await expect(page.getByRole('heading', { name: 'School Profile' })).toBeVisible();
});

test('school details load correctly into the form', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow({ name: 'Riverside Secondary School' }),
  });

  await page.goto('/school/profile');

  await expect(page.getByLabel('School name')).toHaveValue('Riverside Secondary School');
  await expect(page.getByLabel('Registration number')).toHaveValue('GDE-2024-00123');
  await expect(page.getByLabel('Email')).toHaveValue('info@riverside.funda360.dev');
  await expect(page.getByLabel('Phone')).toHaveValue('+27 11 555 0100');
  await expect(page.getByLabel('Website')).toHaveValue('https://riverside.funda360.dev');
  await expect(page.getByLabel('Physical address')).toHaveValue(
    '12 River Road, Johannesburg, 2001',
  );
  await expect(page.getByLabel('Postal address')).toHaveValue('PO Box 456, Johannesburg, 2000');
  await expect(page.getByLabel('Principal name')).toHaveValue('Thabo Nkosi');
  await expect(page.getByText('Active')).toBeVisible();
});

test('school details update successfully', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.route('**/rest/v1/schools*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...buildMockSchoolRow(), principal_name: 'Naledi Dlamini' }),
    });
  });

  await page.goto('/school/profile');
  await page.getByLabel('Principal name').fill('Naledi Dlamini');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('status')).toHaveText('School profile updated successfully.');
  await expect(page.getByLabel('Principal name')).toHaveValue('Naledi Dlamini');
});

test('a role without school.manage permission sees a clear error on save', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ firstName: 'Naledi', lastName: 'Dlamini' }),
    school: buildMockSchoolRow(),
  });

  // RLS rejects the write for a role without school.manage — PostgREST
  // returns 403 with no matching row, which supabase-js surfaces as an error.
  await page.route('**/rest/v1/schools*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        code: '42501',
        message: 'new row violates row-level security policy for table "schools"',
        details: null,
        hint: null,
      }),
    });
  });

  await page.goto('/school/profile');
  await page.getByLabel('Principal name').fill('Should not persist');
  await page.getByRole('button', { name: 'Save changes' }).click();

  // getDbErrorMessage (src/lib/dbErrors.ts) maps SQLSTATE 42501 to safe
  // copy instead of surfacing the raw RLS policy text from the mock above.
  await expect(page.getByRole('alert')).toHaveText(
    "You don't have permission to perform this action.",
  );
});

test('principal can upload a school logo', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installStorageUploadMock(page, 'school-logos');

  let patchedLogoUrl: unknown;
  await page.route('**/rest/v1/schools*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const body = route.request().postDataJSON() as { logo_url?: string };
    patchedLogoUrl = body.logo_url;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...buildMockSchoolRow(), logo_url: patchedLogoUrl }),
    });
  });

  await page.goto('/school/profile');
  await page.getByLabel('Logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('mock png bytes'),
  });

  await expect(page.getByText('Uploading…')).toHaveCount(0);
  expect(patchedLogoUrl).toBe(`${buildMockSchoolRow().id}/logo`);
});

test('an unsupported logo file type is rejected before any upload request is made', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  let uploadAttempted = false;
  await page.route('**/storage/v1/object/school-logos/**', async (route) => {
    uploadAttempted = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/school/profile');
  await page.getByLabel('Logo').setInputFiles({
    name: 'logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg></svg>'),
  });

  await expect(page.getByText(/file type isn't supported/i)).toBeVisible();
  expect(uploadAttempted).toBe(false);
});

test('a failed logo upload shows a friendly error', async ({ page }) => {
  await seedAuthenticatedSession(page);
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installStorageUploadMock(page, 'school-logos', 500);

  await page.goto('/school/profile');
  await page.getByLabel('Logo').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('mock png bytes'),
  });

  await expect(page.getByText('Failed to upload logo.')).toBeVisible();
});

test('unauthenticated visitors are redirected away from the school profile page', async ({
  page,
}) => {
  await page.goto('/school/profile');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
});
