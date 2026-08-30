import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockEmployeeRow,
  buildMockLearnerRow,
  installDataMocks,
  installEmployeeDetailMock,
  installReportRowsMock,
  installLearnerChildListMock,
  installAcademicListMock,
  installLeaveRequestsMock,
} from './utils/mockData';

/**
 * MyProfilePage calls useMyTeachingAssignments()/useClasses()/useSubjects()
 * unconditionally, regardless of role — same as useMyEmployee() (see
 * assessments.spec.ts's "My Classes links..." investigation). None of this
 * file's tests mocked those three tables, so every test in it was making a
 * genuine, unmocked round trip per run to whatever real Supabase instance
 * VITE_SUPABASE_URL points at, with a fabricated session token — the actual
 * cause of this file's previously-observed, previously-unexplained
 * under-load flakiness. Applied once here and spread into every test below,
 * matching how installEmployeeDetailMock is already used throughout.
 */
async function installMyProfileAcademicMocks(page: Parameters<typeof installAcademicListMock>[0]) {
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installAcademicListMock(page, 'classes', []);
  await installAcademicListMock(page, 'subjects', []);
  await installLeaveRequestsMock(page, []);
}

test('an employee-linked account sees the Employee Information section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, buildMockEmployeeRow());
  await installMyProfileAcademicMocks(page);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();
  await expect(page.getByText('Karabo Mokoena')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My Children' })).toHaveCount(0);
});

// Guardian-specific content (My Children, medical info, emergency contacts,
// multi-child, empty state) moved to parent-portal.spec.ts — guardians no
// longer land on this page at all (see RedirectGuardiansToParentPortal in
// AppRoutes.tsx). The one guardian-relevant behavior left to verify here is
// that the redirect actually happens, which the following test covers.
test('a guardian is redirected away from the staff profile page to the Parent Portal', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'guardian' }), school: buildMockSchoolRow() });
  await installReportRowsMock(page, 'learners', []);
  await installLearnerChildListMock(page, 'learner_enrollments', []);
  await installAcademicListMock(page, 'grades', []);
  await installAcademicListMock(page, 'classes', []);
  await installAcademicListMock(page, 'class_teacher_assignments', []);

  await page.goto('/my-profile');
  await expect(page).toHaveURL('http://localhost:5173/parent/dashboard');
});

test('a user with neither an employee nor a guardian linkage still sees the always-present Security section', async ({ page }) => {
  // FND-ARCH-003: MfaEnrollmentCard is unconditional (every account can
  // manage its own two-factor authentication regardless of what else is
  // linked to it), so this page no longer has a true "nothing at all"
  // empty state — the old "There's nothing linked to your account yet."
  // notice was retired along with that possibility.
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'finance_manager' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installMyProfileAcademicMocks(page);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'My Children' })).toHaveCount(0);
});

test('a role with learner.view does not see the entire roster mislabeled as "My Children"', async ({ page }) => {
  // useMyLearners() is an unfiltered query relying on RLS to scope it to
  // guardians — a role that ALSO gets school-wide learner visibility at
  // the RLS layer (principal, via can_view_learners()) would otherwise see
  // every learner in the school rendered under "My Children". Verifies the
  // page-level fix: that section is suppressed for any role holding
  // learner.view, since those roles have the real Learners directory for
  // this purpose.
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'principal' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installMyProfileAcademicMocks(page);
  await installReportRowsMock(page, 'learners', [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi' }),
    buildMockLearnerRow({ id: 'learner-2', firstName: 'Sipho' }),
  ]);

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'My Children' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();
});

test('an employee-linked account can view their leave history and submit a new request', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, buildMockEmployeeRow());
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installAcademicListMock(page, 'classes', []);
  await installAcademicListMock(page, 'subjects', []);
  await installReportRowsMock(page, 'learners', []);

  await installLeaveRequestsMock(page, [
    { id: 'leave-1', employee_id: 'employee-1', leave_type: 'annual', start_date: '2026-09-14', end_date: '2026-09-16', reason: 'Family trip', status: 'pending', reviewed_by: null, reviewed_at: null, review_notes: null, created_at: '2026-08-01T00:00:00Z' },
  ]);
  await page.route('**/rest/v1/leave_requests*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, {
      id: 'leave-2', employee_id: 'employee-1', leave_type: 'sick', start_date: '2026-09-20', end_date: '2026-09-20',
      reason: 'Doctor appointment', status: 'pending', reviewed_by: null, reviewed_at: null, review_notes: null, created_at: '2026-08-02T00:00:00Z',
    });
  });

  await page.goto('/my-profile');
  await expect(page.getByRole('heading', { name: 'Leave' })).toBeVisible();
  await expect(page.getByText('Family trip')).toBeVisible();
  await expect(page.getByText('Pending')).toBeVisible();

  await page.getByRole('button', { name: 'Request leave' }).click();
  await page.getByLabel('Leave type').selectOption('sick');
  await page.getByLabel('Start date').fill('2026-09-20');
  await page.getByLabel('End date').fill('2026-09-20');
  await page.getByLabel('Reason').fill('Doctor appointment');
  await page.getByRole('button', { name: 'Submit request' }).click();

  await expect(page.getByRole('heading', { name: 'Request leave' })).toHaveCount(0);
});

test('any authenticated role can reach /my-profile without a permission redirect', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'auditor' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'auditor' }), school: buildMockSchoolRow() });
  await installEmployeeDetailMock(page, null);
  await installMyProfileAcademicMocks(page);
  await installReportRowsMock(page, 'learners', []);

  await page.goto('/my-profile');
  await expect(page).toHaveURL('http://localhost:5173/my-profile');
});
