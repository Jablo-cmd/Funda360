import { test } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from '../../e2e/utils/mockAuth';
import { buildMockAcademicYearRow, buildMockLearnerRow, buildMockProfileRow, buildMockSchoolRow } from '../../e2e/utils/mockData';

const ROUTES = ['/dashboard', '/learners', '/attendance', '/fees', '/fees/invoices', '/admissions', '/reports', '/reports/attendance', '/timetable', '/academic/assessments', '/report-cards', '/announcements'];

test('probe', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  const profile = buildMockProfileRow({ role: 'principal', firstName: 'Lindiwe', lastName: 'Mokoena' });
  const school = buildMockSchoolRow({ name: 'Ridgeview Secondary School' });
  const learners = [buildMockLearnerRow()];
  await page.route('**/rest/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const table = pathname.split('/').pop();
    if (table === 'profiles') return fulfillJson(route, profile);
    if (table === 'schools') return fulfillJson(route, school);
    if (table === 'academic_years') return fulfillJson(route, [buildMockAcademicYearRow({ id: 'year-1', isActive: true })]);
    if (table === 'learners') return fulfillJson(route, learners);
    console.log('REQ', route.request().method(), pathname.replace('/rest/v1', ''));
    return fulfillJson(route, []);
  });
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `probe/${r.slice(1).replace(/\//g, '_')}.png` });
  }
});
