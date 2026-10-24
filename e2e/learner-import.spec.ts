import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, buildMockLearnerRow, installDataMocks } from './utils/mockData';

const CSV_HEADER = 'learnerNumber,admissionNumber,firstName,lastName,dateOfBirth,admissionDate,gender,homeLanguage';

async function installLearnersRouteForImport(page: import('@playwright/test').Page, createdRows: Record<string, unknown>[]) {
  await page.route('**/rest/v1/learners*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'POST') {
      await fulfillJson(route, createdRows);
      return;
    }
    if (request.method() !== 'GET') return route.fallback();

    // The CSV import's duplicate-check fetch selects only these two
    // columns (no limit/offset — paged via .range()/the Range header) —
    // distinguish it from the paginated directory list query.
    if (url.searchParams.get('select') === 'learner_number,admission_number') {
      await fulfillJson(route, []);
      return;
    }

    // Paginated directory list (limit/offset present).
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0', 'access-control-expose-headers': 'content-range' },
      body: JSON.stringify([]),
    });
  });
}

test('a principal can import learners from a CSV file, preview validation, and commit the import', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersRouteForImport(page, [
    buildMockLearnerRow({ id: 'learner-10', firstName: 'Naledi', lastName: 'Dube' }),
    buildMockLearnerRow({ id: 'learner-11', firstName: 'Sipho', lastName: 'Khumalo' }),
  ]);

  await page.goto('/learners');
  await page.getByRole('button', { name: 'Import CSV' }).click();
  await expect(page.getByRole('heading', { name: 'Import learners from CSV' })).toBeVisible();

  const csv = [
    CSV_HEADER,
    'LRN-1001,ADM-1001,Naledi,Dube,2013-05-01,2026-01-15,female,English',
    'LRN-1002,ADM-1002,Sipho,Khumalo,2012-08-20,2026-01-15,male,isiZulu',
    'LRN-1003,ADM-1003,,Missing First Name,2013-01-01,2026-01-15,,',
  ].join('\n');

  await page.setInputFiles('#learner-import-file', {
    name: 'learners.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });

  await expect(page.getByText('2 valid, 1 with errors.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 2 learners' })).toBeVisible();

  await page.getByRole('button', { name: 'Import 2 learners' }).click();
  await expect(page.getByText('2 learners imported successfully.')).toBeVisible();
});

test('an empty CSV import shows a clear message rather than a silent no-op', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersRouteForImport(page, []);

  await page.goto('/learners');
  await page.getByRole('button', { name: 'Import CSV' }).click();

  await page.setInputFiles('#learner-import-file', {
    name: 'empty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV_HEADER, 'utf-8'),
  });

  await expect(page.getByText('0 valid, 0 with errors.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Import \d+ learner/ })).toHaveCount(0);
});

test('a role with learner.view but not learner.manage does not see the Import CSV button', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'medical_officer' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'medical_officer' }), school: buildMockSchoolRow() });
  await installLearnersRouteForImport(page, []);

  await page.goto('/learners');
  await expect(page.getByRole('heading', { name: 'Learners' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import CSV' })).toHaveCount(0);
});

test('a CSV with guardian columns links siblings to one new guardian and invites them', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnersRouteForImport(page, [
    buildMockLearnerRow({ id: 'learner-20', learnerNumber: 'LRN-2001', firstName: 'Naledi', lastName: 'Dube' }),
    buildMockLearnerRow({ id: 'learner-21', learnerNumber: 'LRN-2002', firstName: 'Sipho', lastName: 'Dube' }),
  ]);

  // The guardian lookup is a profiles list query filtered by role; anything
  // else on /profiles (the signed-in user's own profile) falls through.
  await page.route('**/rest/v1/profiles*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('role')) return fulfillJson(route, []);
    return route.fallback();
  });
  const created: unknown[] = [];
  await page.route('**/rest/v1/rpc/admin_create_guardian', async (route) => {
    created.push(route.request().postDataJSON());
    await fulfillJson(route, [{ user_id: 'guardian-1' }]);
  });
  const links: Array<Record<string, unknown>> = [];
  await page.route('**/rest/v1/learner_guardians*', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    links.push(body);
    await fulfillJson(route, { id: `link-${links.length}`, ...body, active: true, created_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:00:00Z' });
  });
  let invited = 0;
  await page.route('**/rest/v1/rpc/send_guardian_invitation', async (route) => {
    invited += 1;
    await fulfillJson(route, {
      id: 'inv-1',
      guardian_profile_id: 'guardian-1',
      status: 'pending',
      invited_at: '2026-10-24T00:00:00Z',
      expires_at: '2026-11-07T00:00:00Z',
      accepted_at: null,
      revoked_at: null,
    });
  });
  await page.route('**/auth/v1/recover*', (route) => fulfillJson(route, {}));

  await page.goto('/learners');
  await page.getByRole('button', { name: 'Import CSV' }).click();

  const csv = [
    `${CSV_HEADER},guardianFirstName,guardianLastName,guardianEmail,guardianPhone,guardianRelationship`,
    'LRN-2001,ADM-2001,Naledi,Dube,2013-05-01,2026-01-15,female,English,Thandi,Dube,Thandi.Dube@example.com,0821234567,mother',
    'LRN-2002,ADM-2002,Sipho,Dube,2015-03-11,2026-01-15,male,English,Thandi,Dube,thandi.dube@example.com,0821234567,mother',
  ].join('\n');
  await page.setInputFiles('#learner-import-file', { name: 'learners.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });

  await expect(page.getByText('2 valid, 0 with errors.')).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 learners' }).click();

  await expect(page.getByText('Guardians: 1 added, 0 already on file, 2 links made, 1 invitation sent.')).toBeVisible();
  expect(created).toHaveLength(1);
  expect(links.map((link) => link.learner_id).sort()).toEqual(['learner-20', 'learner-21']);
  expect(links.every((link) => link.guardian_profile_id === 'guardian-1' && link.relationship_type === 'mother')).toBe(true);
  expect(invited).toBe(1);
});
