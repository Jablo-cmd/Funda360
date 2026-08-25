import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute';
import { TenantGate } from '@/routes/TenantGate';
import { RequirePermission } from '@/routes/RequirePermission';
import { RequireGuardianRole } from '@/routes/RequireGuardianRole';
import { RedirectGuardiansToParentPortal } from '@/routes/RedirectGuardiansToParentPortal';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ParentLayout } from '@/components/layout/ParentLayout';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';

/**
 * Route-level code splitting: each page becomes its own chunk, fetched only
 * when its route is visited, instead of one 600KB+ bundle shipped up front
 * (see the vite build warning this replaced). `named` adapts a module's
 * named export to the default export React.lazy requires, without
 * renaming exports across the codebase.
 */
function named<T extends ComponentType<object>>(
  load: () => Promise<Record<string, T>>,
  exportName: string,
) {
  return lazy(() => load().then((module) => ({ default: module[exportName] as T })));
}

const LoginPage = named(() => import('@/features/auth/pages/LoginPage'), 'LoginPage');
const ForgotPasswordPage = named(
  () => import('@/features/auth/pages/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ResetPasswordPage = named(
  () => import('@/features/auth/pages/ResetPasswordPage'),
  'ResetPasswordPage',
);
const ActivateAccountPage = named(
  () => import('@/features/auth/pages/ActivateAccountPage'),
  'ActivateAccountPage',
);
const VerifyEmailPage = named(
  () => import('@/features/auth/pages/VerifyEmailPage'),
  'VerifyEmailPage',
);
const DashboardPage = named(() => import('@/pages/DashboardPage'), 'DashboardPage');
const MyProfilePage = named(() => import('@/pages/MyProfilePage'), 'MyProfilePage');
const SchoolProfilePage = named(
  () => import('@/features/school/pages/SchoolProfilePage'),
  'SchoolProfilePage',
);
const SchoolsPage = named(() => import('@/features/tenant/pages/SchoolsPage'), 'SchoolsPage');
const UsersPage = named(() => import('@/features/users/pages/UsersPage'), 'UsersPage');
const UserProfilePage = named(
  () => import('@/features/users/pages/UserProfilePage'),
  'UserProfilePage',
);
const AcademicOverviewPage = named(
  () => import('@/features/academic/pages/AcademicOverviewPage'),
  'AcademicOverviewPage',
);
const AcademicYearsPage = named(
  () => import('@/features/academic/pages/AcademicYearsPage'),
  'AcademicYearsPage',
);
const TermsPage = named(() => import('@/features/academic/pages/TermsPage'), 'TermsPage');
const GradesPage = named(() => import('@/features/academic/pages/GradesPage'), 'GradesPage');
const ClassesPage = named(() => import('@/features/academic/pages/ClassesPage'), 'ClassesPage');
const SubjectsPage = named(() => import('@/features/academic/pages/SubjectsPage'), 'SubjectsPage');
const TeachingAssignmentsPage = named(
  () => import('@/features/teaching/pages/TeachingAssignmentsPage'),
  'TeachingAssignmentsPage',
);
const LearnersPage = named(() => import('@/features/learners/pages/LearnersPage'), 'LearnersPage');
const LearnerProfilePage = named(
  () => import('@/features/learners/pages/LearnerProfilePage'),
  'LearnerProfilePage',
);
const GuardiansPage = named(
  () => import('@/features/guardians/pages/GuardiansPage'),
  'GuardiansPage',
);
const GuardianProfilePage = named(
  () => import('@/features/guardians/pages/GuardianProfilePage'),
  'GuardianProfilePage',
);
const EmployeesPage = named(
  () => import('@/features/employees/pages/EmployeesPage'),
  'EmployeesPage',
);
const EmployeeProfilePage = named(
  () => import('@/features/employees/pages/EmployeeProfilePage'),
  'EmployeeProfilePage',
);
const DepartmentsPage = named(
  () => import('@/features/employees/pages/DepartmentsPage'),
  'DepartmentsPage',
);
const ReportsOverviewPage = named(
  () => import('@/features/reports/pages/ReportsOverviewPage'),
  'ReportsOverviewPage',
);
const LearnerReportPage = named(
  () => import('@/features/reports/pages/LearnerReportPage'),
  'LearnerReportPage',
);
const EmployeeReportPage = named(
  () => import('@/features/reports/pages/EmployeeReportPage'),
  'EmployeeReportPage',
);
const AcademicReportPage = named(
  () => import('@/features/reports/pages/AcademicReportPage'),
  'AcademicReportPage',
);
const AttendancePage = named(
  () => import('@/features/attendance/pages/AttendancePage'),
  'AttendancePage',
);
const AssessmentsPage = named(
  () => import('@/features/assessments/pages/AssessmentsPage'),
  'AssessmentsPage',
);
const AssessmentDetailPage = named(
  () => import('@/features/assessments/pages/AssessmentDetailPage'),
  'AssessmentDetailPage',
);
const TimetablePage = named(
  () => import('@/features/timetable/pages/TimetablePage'),
  'TimetablePage',
);
const AssessmentReportPage = named(
  () => import('@/features/reports/pages/AssessmentReportPage'),
  'AssessmentReportPage',
);
const AttendanceReportPage = named(
  () => import('@/features/reports/pages/AttendanceReportPage'),
  'AttendanceReportPage',
);
const ParentDashboardPage = named(
  () => import('@/features/parentPortal/pages/ParentDashboardPage'),
  'ParentDashboardPage',
);
const ParentChildrenPage = named(
  () => import('@/features/parentPortal/pages/ParentChildrenPage'),
  'ParentChildrenPage',
);
const ParentChildProfilePage = named(
  () => import('@/features/parentPortal/pages/ParentChildProfilePage'),
  'ParentChildProfilePage',
);
const ParentProfilePage = named(
  () => import('@/features/parentPortal/pages/ParentProfilePage'),
  'ParentProfilePage',
);

export function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/activate-account" element={<ActivateAccountPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<TenantGate />}>
            <Route element={<DashboardLayout />}>
              {/* /dashboard, /my-profile, /school/profile are the only staff
                  routes with no RequirePermission guard (any signed-in,
                  tenant-gated user could otherwise reach them) — every other
                  route below is already safe from guardians via
                  RequirePermission + their empty ROLE_PERMISSIONS entry. */}
              <Route element={<RedirectGuardiansToParentPortal />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/my-profile" element={<MyProfilePage />} />
                <Route path="/school/profile" element={<SchoolProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="tenant.switch" />}>
                <Route path="/schools" element={<SchoolsPage />} />
              </Route>

              <Route element={<RequirePermission permission="profile.view_any" />}>
                <Route path="/users" element={<UsersPage />} />
                <Route path="/users/:id" element={<UserProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="academic.view" />}>
                <Route path="/academic" element={<AcademicOverviewPage />} />
                <Route path="/academic/years" element={<AcademicYearsPage />} />
                <Route path="/academic/terms" element={<TermsPage />} />
                <Route path="/academic/grades" element={<GradesPage />} />
                <Route path="/academic/classes" element={<ClassesPage />} />
                <Route path="/academic/subjects" element={<SubjectsPage />} />
                <Route
                  path="/academic/teaching-assignments"
                  element={<TeachingAssignmentsPage />}
                />
              </Route>

              <Route element={<RequirePermission permission="assessment.view" />}>
                <Route path="/academic/assessments" element={<AssessmentsPage />} />
                <Route path="/academic/assessments/:id" element={<AssessmentDetailPage />} />
              </Route>

              <Route element={<RequirePermission permission="learner.view" />}>
                <Route path="/learners" element={<LearnersPage />} />
                <Route path="/learners/:id" element={<LearnerProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="timetable.view" />}>
                <Route path="/timetable" element={<TimetablePage />} />
              </Route>

              <Route element={<RequirePermission permission="guardian.view" />}>
                <Route path="/guardians" element={<GuardiansPage />} />
                <Route path="/guardians/:id" element={<GuardianProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="employee.view" />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/departments" element={<DepartmentsPage />} />
                <Route path="/employees/:id" element={<EmployeeProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="attendance.view" />}>
                <Route path="/attendance" element={<AttendancePage />} />
              </Route>

              <Route element={<RequirePermission permission="reports.view" />}>
                <Route path="/reports" element={<ReportsOverviewPage />} />
                <Route path="/reports/learners" element={<LearnerReportPage />} />
                <Route path="/reports/employees" element={<EmployeeReportPage />} />
                <Route path="/reports/academic" element={<AcademicReportPage />} />
                <Route path="/reports/assessments" element={<AssessmentReportPage />} />
                <Route path="/reports/attendance" element={<AttendanceReportPage />} />
              </Route>
            </Route>

            <Route element={<RequireGuardianRole />}>
              <Route element={<ParentLayout />}>
                <Route path="/parent/dashboard" element={<ParentDashboardPage />} />
                <Route path="/parent/children" element={<ParentChildrenPage />} />
                <Route path="/parent/children/:learnerId" element={<ParentChildProfilePage />} />
                <Route path="/parent/profile" element={<ParentProfilePage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
