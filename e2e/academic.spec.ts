import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockGradeRow,
  buildMockClassRow,
  buildMockSubjectRow,
  buildMockTermRow,
  installDataMocks,
  installAcademicListMock,
  installSetActiveAcademicYearMock,
} from './utils/mockData';

test('principal can view the academic overview with the current academic year', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  await page.goto('/academic');
  await expect(page.getByRole('heading', { name: 'Academic Structure' })).toBeVisible();
  await expect(page.getByText('2026 Academic Year')).toBeVisible();
  await expect(page.getByRole('link', { name: /Academic Years/ })).toBeVisible();
});

test('principal can create an academic year', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow(), academicYears: [] });

  await page.route('**/rest/v1/academic_years*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockAcademicYearRow({ id: 'year-2027', name: '2027 Academic Year', isActive: false }));
  });

  await page.goto('/academic/years');
  await page.getByRole('button', { name: 'Add academic year' }).click();
  await page.getByLabel('Name').fill('2027 Academic Year');
  await page.getByLabel('Start date').fill('2027-01-15');
  await page.getByLabel('End date').fill('2027-12-05');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add academic year' })).toHaveCount(0);
});

test('academic year form rejects an end date before the start date', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow(), academicYears: [] });

  await page.goto('/academic/years');
  await page.getByRole('button', { name: 'Add academic year' }).click();
  await page.getByLabel('Name').fill('Invalid year');
  await page.getByLabel('Start date').fill('2027-06-01');
  await page.getByLabel('End date').fill('2027-01-01');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('End date must be after the start date')).toBeVisible();
  // The modal must still be open — an invalid form never reaches the network.
  await expect(page.getByRole('heading', { name: 'Add academic year' })).toBeVisible();
});

test('only one academic year can be active — activating a different year deactivates the current one', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  let years = [
    buildMockAcademicYearRow({ id: 'year-2026', name: '2026 Academic Year', isActive: true }),
    buildMockAcademicYearRow({ id: 'year-2027', name: '2027 Academic Year', isActive: false }),
  ];
  await page.route('**/rest/v1/academic_years*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, years);
  });
  await installSetActiveAcademicYearMock(page, async (route) => {
    years = years.map((year) => ({ ...year, is_active: year.id === 'year-2027' }));
    await fulfillJson(route, years.find((year) => year.id === 'year-2027'));
  });

  await page.goto('/academic/years');
  await expect(page.getByRole('row', { name: /2026 Academic Year/ }).getByText('Active')).toBeVisible();

  await page.getByRole('row', { name: /2027 Academic Year/ }).getByRole('button', { name: 'Set active' }).click();

  await expect(page.getByRole('row', { name: /2027 Academic Year/ }).getByText('Active')).toBeVisible();
  await expect(page.getByRole('row', { name: /2026 Academic Year/ }).getByText('Archived')).toBeVisible();
});

test('principal can create and archive a grade', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow(), academicYears: [] });
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);

  await page.route('**/rest/v1/grades*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      return fulfillJson(route, buildMockGradeRow({ id: 'grade-9', name: 'Grade 9', code: 'G9', sortOrder: 9 }));
    }
    if (method === 'PATCH') {
      return fulfillJson(route, buildMockGradeRow({ active: false }));
    }
    return route.fallback();
  });

  await page.goto('/academic/grades');
  await expect(page.getByText('Grade 8')).toBeVisible();

  await page.getByRole('button', { name: 'Add grade' }).click();
  await page.getByLabel('Name').fill('Grade 9');
  await page.getByLabel('Code').fill('G9');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Add grade' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Archive' }).click();
});

test('principal can create a class assigned to a grade', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow(), academicYears: [] });
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);
  await installAcademicListMock(page, 'classes', []);

  await page.route('**/rest/v1/classes*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockClassRow());
  });

  await page.goto('/academic/classes');
  await page.getByRole('button', { name: 'Add class' }).click();
  await expect(page.getByLabel('Grade')).toHaveValue('grade-8');
  await page.getByLabel('Name').fill('Grade 8A');
  await page.getByLabel('Capacity').fill('32');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add class' })).toHaveCount(0);
});

test('principal can search subjects', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow(), academicYears: [] });
  await installAcademicListMock(page, 'subjects', [
    buildMockSubjectRow(),
    buildMockSubjectRow({ id: 'subject-eng', name: 'English', code: 'ENG' }),
  ]);

  await page.goto('/academic/subjects');
  await expect(page.getByText('Mathematics')).toBeVisible();
  await expect(page.getByText('English')).toBeVisible();

  await page.getByLabel('Search subjects').fill('english');
  await expect(page.getByText('English')).toBeVisible();
  await expect(page.getByText('Mathematics')).toHaveCount(0);
});

test('principal can create a term within the selected academic year', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'terms', []);

  await page.route('**/rest/v1/terms*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockTermRow());
  });

  await page.goto('/academic/terms');
  await expect(page.getByLabel('Academic year')).toHaveValue('year-2026');

  await page.getByRole('button', { name: 'Add term' }).click();
  await page.getByLabel('Name').fill('Term 1');
  await page.getByLabel('Sequence').fill('1');
  await page.getByLabel('Start date').fill('2026-01-15');
  await page.getByLabel('End date').fill('2026-04-01');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add term' })).toHaveCount(0);
});

test('teacher has read-only access to academic pages', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'grades', [buildMockGradeRow()]);

  await page.goto('/academic/years');
  await expect(page.getByText('2026 Academic Year')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add academic year' })).toHaveCount(0);

  await page.goto('/academic/grades');
  await expect(page.getByText('Grade 8')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add grade' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});

test('a role without academic.view is blocked from the academic section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'learner' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'learner' }),
    school: buildMockSchoolRow(),
    academicYears: [],
  });

  await page.goto('/academic');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Academic' })).toHaveCount(0);
});

test('tenant isolation: the academic years list only ever reflects the caller\'s own tenant scope', async ({ page }) => {
  // As with the equivalent Users directory test, RLS (verified independently
  // in supabase/rls-tests/tests/academic_structure.test.sql) is the actual
  // tenant-isolation boundary — this only demonstrates that the client
  // renders exactly the rows its (tenant-scoped) query returns, nothing more.
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ schoolId: 'tenant-demo' })],
  });

  await page.goto('/academic/years');
  await expect(page.getByText('2026 Academic Year')).toBeVisible();
  await expect(page.getByText(/other-school/)).toHaveCount(0);
});
