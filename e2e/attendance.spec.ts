import { test, expect } from '@playwright/test';
import { MOCK_USER_ID, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockClassRow,
  buildMockClassTeacherAssignmentRow,
  buildMockLearnerRow,
  buildMockLearnerEnrollmentRow,
  buildMockAttendanceRecordRow,
  installDataMocks,
  installAcademicListMock,
  installLearnerChildListMock,
  installLearnersListMock,
  installEmployeesListMock,
  installUsersListMock,
  installReportRowsMock,
  installAttendanceRecordsMock,
  installAttendanceUpsertMock,
} from './utils/mockData';

test('a teacher can view and mark attendance for their assigned class', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', [
    buildMockClassTeacherAssignmentRow({ teacherProfileId: MOCK_USER_ID }),
  ]);
  await installLearnerChildListMock(page, 'learner_enrollments', [
    buildMockLearnerEnrollmentRow({ learnerId: 'learner-1' }),
    buildMockLearnerEnrollmentRow({ id: 'enrollment-2', learnerId: 'learner-2' }),
  ]);
  await installReportRowsMock(page, 'learners', [
    buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' }),
    buildMockLearnerRow({ id: 'learner-2', firstName: 'Sipho', lastName: 'Khumalo' }),
  ]);
  await installAttendanceRecordsMock(page, []);
  await installAttendanceUpsertMock(page, [
    buildMockAttendanceRecordRow({ learnerId: 'learner-1', status: 'absent' }),
    buildMockAttendanceRecordRow({ id: 'attendance-2', learnerId: 'learner-2', status: 'present' }),
  ]);

  await page.goto('/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
  await expect(page.getByText('Naledi Dube')).toBeVisible();
  await expect(page.getByText('Sipho Khumalo')).toBeVisible();

  const naledisRow = page.locator('tr', { hasText: 'Naledi Dube' });
  await naledisRow.getByRole('button', { name: 'Absent' }).click();
  await page.getByRole('button', { name: 'Save register' }).click();

  await expect(page.getByText('Register saved.')).toBeVisible();
});

test('a principal can record attendance for any class, not just their own', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAcademicListMock(page, 'classes', [buildMockClassRow()]);
  await installAcademicListMock(page, 'class_teacher_assignments', []);
  await installLearnerChildListMock(page, 'learner_enrollments', [buildMockLearnerEnrollmentRow({ learnerId: 'learner-1' })]);
  await installReportRowsMock(page, 'learners', [buildMockLearnerRow({ id: 'learner-1', firstName: 'Naledi', lastName: 'Dube' })]);
  await installAttendanceRecordsMock(page, []);

  await page.goto('/attendance');
  await expect(page.getByLabel('Class')).toBeVisible();
  await expect(page.getByText('Naledi Dube')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save register' })).toBeVisible();
});

test('a role without attendance.view is blocked from the attendance page', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });

  await page.goto('/attendance');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Attendance' })).toHaveCount(0);
});

test('dashboard shows today\'s attendance summary once registers have been taken', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  const today = new Date().toISOString().slice(0, 10);
  await installAttendanceRecordsMock(page, [
    buildMockAttendanceRecordRow({ learnerId: 'learner-1', attendanceDate: today, status: 'present' }),
    buildMockAttendanceRecordRow({ id: 'attendance-2', learnerId: 'learner-2', attendanceDate: today, status: 'present' }),
    buildMockAttendanceRecordRow({ id: 'attendance-3', learnerId: 'learner-3', attendanceDate: today, status: 'absent' }),
  ]);
  await installLearnersListMock(page, []);
  await installEmployeesListMock(page, []);
  await installUsersListMock(page, [buildMockProfileRow()]);

  await page.goto('/dashboard');
  const attendancePanel = page.locator('section', { has: page.getByRole('heading', { name: 'Attendance Overview' }) });
  await expect(attendancePanel.getByText('00,002', { exact: true })).toBeVisible();
  await expect(attendancePanel.getByText('00,001', { exact: true })).toBeVisible();
});

test('dashboard shows an empty state when no attendance has been recorded today', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, {
    profile: buildMockProfileRow(),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installAttendanceRecordsMock(page, []);
  await installLearnersListMock(page, []);
  await installEmployeesListMock(page, []);
  await installUsersListMock(page, [buildMockProfileRow()]);

  await page.goto('/dashboard');
  await expect(page.getByText('No attendance recorded for today yet.')).toBeVisible();
});
