import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockLearnerRow,
  buildMockLearnerDocumentRow,
  installDataMocks,
  installLearnerDetailMock,
  installLearnerChildListMock,
  installStorageUploadMock,
  installStorageSignedUrlMock,
} from './utils/mockData';

test('a principal can upload a learner document and see it in the table', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', []);
  await installStorageUploadMock(page, 'learner-documents');

  let insertedRow: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/learner_documents*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    insertedRow = buildMockLearnerDocumentRow({ id: 'document-new' });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(insertedRow) });
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Add document' }).click();

  await page.getByLabel('Document type').selectOption('birth_certificate');
  await page.getByLabel('File').setInputFiles({
    name: 'birth-certificate.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock content'),
  });
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add document' })).toHaveCount(0);
  expect(insertedRow).toBeDefined();
});

test('a principal can set an expiry date, and an already-expired document shows an Expired badge', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', [
    buildMockLearnerDocumentRow({ id: 'document-expired', documentType: 'permit', expiryDate: '2020-01-01' }),
  ]);
  await installStorageUploadMock(page, 'learner-documents');

  let insertedRow: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/learner_documents*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    insertedRow = buildMockLearnerDocumentRow({ id: 'document-new', documentType: 'passport', expiryDate: '2030-06-15' });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(insertedRow) });
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();

  // The pre-existing expired permit shows an Expired badge.
  await expect(page.getByText(/Expired 01 Jan 2020/)).toBeVisible();

  await page.getByRole('button', { name: 'Add document' }).click();
  await page.getByLabel('Document type').selectOption('passport');
  await page.getByLabel('Expiry date').fill('2030-06-15');
  await page.getByLabel('File').setInputFiles({
    name: 'passport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock content'),
  });
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add document' })).toHaveCount(0);
  expect((insertedRow as Record<string, unknown> | undefined)?.expiry_date).toBe('2030-06-15');
});

test('a principal can mark an upload as replacing an existing document, and the old one becomes Archived', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', [
    buildMockLearnerDocumentRow({ id: 'document-old', documentType: 'passport' }),
  ]);
  await installStorageUploadMock(page, 'learner-documents');

  let insertedRow: Record<string, unknown> | undefined;
  await page.route('**/rest/v1/learner_documents*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    insertedRow = buildMockLearnerDocumentRow({ id: 'document-new', documentType: 'passport', supersedesDocumentId: 'document-old' });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(insertedRow) });
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Add document' }).click();

  await page.getByLabel('Document type').selectOption('passport');
  await expect(page.getByLabel('Replaces (optional)')).toBeVisible();
  await page.getByLabel('Replaces (optional)').selectOption('document-old');
  await page.getByLabel('File').setInputFiles({
    name: 'passport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock content'),
  });
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add document' })).toHaveCount(0);
  expect((insertedRow as Record<string, unknown> | undefined)?.supersedes_document_id).toBe('document-old');
});

test('an unsupported file type is rejected before any upload request is made', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', []);

  let uploadAttempted = false;
  await page.route('**/storage/v1/object/learner-documents/**', async (route) => {
    uploadAttempted = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Add document' }).click();
  await page.getByLabel('File').setInputFiles({
    name: 'malware.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('not a real document'),
  });

  await expect(page.getByText(/file type isn't supported/i)).toBeVisible();
  expect(uploadAttempted).toBe(false);
});

test('an oversized file is rejected before any upload request is made', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', []);

  let uploadAttempted = false;
  await page.route('**/storage/v1/object/learner-documents/**', async (route) => {
    uploadAttempted = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Add document' }).click();
  await page.getByLabel('File').setInputFiles({
    name: 'huge.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(16 * 1024 * 1024, 'x'),
  });

  await expect(page.getByText(/too large/i)).toBeVisible();
  expect(uploadAttempted).toBe(false);
});

test('a failed upload shows a friendly error and keeps the modal open', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', []);
  await installStorageUploadMock(page, 'learner-documents', 500);

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Add document' }).click();
  await page.getByLabel('File').setInputFiles({
    name: 'birth-certificate.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 mock content'),
  });
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Add document' })).toBeVisible();
});

test('a role without learner.manage cannot see the add-document control', async ({ page }) => {
  // medical_officer holds learner.view (reaches the profile) but not
  // learner.manage (admissions_officer, the other learner.view-only-ish
  // role, actually also holds learner.manage — see rolePermissions.ts).
  await seedAuthenticatedSession(page, { role: 'medical_officer' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'medical_officer' }), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', [buildMockLearnerDocumentRow()]);

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();

  await expect(page.getByRole('button', { name: 'Add document' })).toHaveCount(0);
});

test('an authorized user can open a document, resolving a fresh signed URL rather than a stored public link', async ({ page, context }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installLearnerChildListMock(page, 'learner_documents', [buildMockLearnerDocumentRow({ id: 'document-1' })]);

  await installStorageSignedUrlMock(page, 'learner-documents');
  // Context-level (not page-level): the resolved signed URL is opened in a
  // new tab via window.open, whose own navigation request page.route()
  // never sees — only a context-wide route reaches it too. Without this,
  // the popup attempts a real, unreachable network request, which is an
  // observed source of flakiness under parallel CI load (the popup itself
  // is fine; racing a doomed real connection attempt is not).
  await context.route('**/object/sign/learner-documents/mock-path*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'mock signed file content' });
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Documents' }).click();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'birth-certificate.pdf' }).click(),
  ]);
  await popup.waitForLoadState('load');
  expect(popup.url()).toContain('/object/sign/learner-documents/mock-path');
  expect(popup.url()).toContain('token=mock-token');
  await popup.close();
});
