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
const MfaChallengePage = named(
  () => import('@/features/mfa/pages/MfaChallengePage'),
  'MfaChallengePage',
);
const DashboardPage = named(() => import('@/pages/DashboardPage'), 'DashboardPage');
const MyProfilePage = named(() => import('@/pages/MyProfilePage'), 'MyProfilePage');
const SchoolProfilePage = named(
  () => import('@/features/school/pages/SchoolProfilePage'),
  'SchoolProfilePage',
);
const SchoolsPage = named(() => import('@/features/tenant/pages/SchoolsPage'), 'SchoolsPage');
const SchoolOnboardingWizardPage = named(
  () => import('@/features/tenant/pages/SchoolOnboardingWizardPage'),
  'SchoolOnboardingWizardPage',
);
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
const AlumniPage = named(() => import('@/features/learners/pages/AlumniPage'), 'AlumniPage');
const AdmissionsPage = named(() => import('@/features/admissions/pages/AdmissionsPage'), 'AdmissionsPage');
const AdmissionApplicationDetailPage = named(
  () => import('@/features/admissions/pages/AdmissionApplicationDetailPage'),
  'AdmissionApplicationDetailPage',
);
const AdmissionRequirementsPage = named(
  () => import('@/features/admissions/pages/AdmissionRequirementsPage'),
  'AdmissionRequirementsPage',
);
const PublicApplyPage = named(() => import('@/features/admissions/pages/PublicApplyPage'), 'PublicApplyPage');
const PublicApplyResumePage = named(
  () => import('@/features/admissions/pages/PublicApplyResumePage'),
  'PublicApplyResumePage',
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
const StaffAttendancePage = named(
  () => import('@/features/employees/pages/StaffAttendancePage'),
  'StaffAttendancePage',
);
const LeaveRequestsPage = named(
  () => import('@/features/employees/pages/LeaveRequestsPage'),
  'LeaveRequestsPage',
);
const SafeguardingOverviewPage = named(
  () => import('@/features/safeguarding/pages/SafeguardingOverviewPage'),
  'SafeguardingOverviewPage',
);
const ReportsOverviewPage = named(
  () => import('@/features/reports/pages/ReportsOverviewPage'),
  'ReportsOverviewPage',
);
const FinanceOverviewPage = named(
  () => import('@/features/fees/pages/FinanceOverviewPage'),
  'FinanceOverviewPage',
);
const BankReconciliationPage = named(
  () => import('@/features/fees/pages/BankReconciliationPage'),
  'BankReconciliationPage',
);
const FeeStructuresPage = named(
  () => import('@/features/fees/pages/FeeStructuresPage'),
  'FeeStructuresPage',
);
const InvoicesRegisterPage = named(
  () => import('@/features/fees/pages/InvoicesRegisterPage'),
  'InvoicesRegisterPage',
);
const PaymentSettingsPage = named(
  () => import('@/features/fees/pages/PaymentSettingsPage'),
  'PaymentSettingsPage',
);
const ParentFeesPage = named(() => import('@/features/parentPortal/pages/ParentFeesPage'), 'ParentFeesPage');
const PaymentReturnPage = named(
  () => import('@/features/fees/pages/PaymentReturnPage'),
  'PaymentReturnPage',
);
const NotificationsPage = named(
  () => import('@/features/notifications/pages/NotificationsPage'),
  'NotificationsPage',
);
const AnnouncementsPage = named(
  () => import('@/features/announcements/pages/AnnouncementsPage'),
  'AnnouncementsPage',
);
const MessagesPage = named(() => import('@/features/messaging/pages/MessagesPage'), 'MessagesPage');
const NotificationSettingsPage = named(
  () => import('@/features/notifications/pages/NotificationSettingsPage'),
  'NotificationSettingsPage',
);
const MessagingSettingsPage = named(
  () => import('@/features/notifications/pages/MessagingSettingsPage'),
  'MessagingSettingsPage',
);
const HomeworkPage = named(() => import('@/features/homework/pages/HomeworkPage'), 'HomeworkPage');
const HomeworkDetailPage = named(
  () => import('@/features/homework/pages/HomeworkDetailPage'),
  'HomeworkDetailPage',
);
const ParentHomeworkPage = named(
  () => import('@/features/homework/pages/ParentHomeworkPage'),
  'ParentHomeworkPage',
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
const GradingScalesPage = named(
  () => import('@/features/reportCards/pages/GradingScalesPage'),
  'GradingScalesPage',
);
const ReportCardTemplatesPage = named(
  () => import('@/features/reportCards/pages/ReportCardTemplatesPage'),
  'ReportCardTemplatesPage',
);
const ReportCardsPage = named(
  () => import('@/features/reportCards/pages/ReportCardsPage'),
  'ReportCardsPage',
);
const ReportCardDetailPage = named(
  () => import('@/features/reportCards/pages/ReportCardDetailPage'),
  'ReportCardDetailPage',
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
        <Route path="/mfa-challenge" element={<MfaChallengePage />} />
        <Route path="/apply" element={<PublicApplyPage />} />
        <Route path="/apply/resume" element={<PublicApplyResumePage />} />

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
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/notifications/settings" element={<NotificationSettingsPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/messages" element={<MessagesPage basePath="/messages" />} />
                <Route path="/messages/:conversationId" element={<MessagesPage basePath="/messages" />} />
              </Route>

              <Route element={<RequirePermission permission="school.manage" />}>
                <Route path="/settings/messaging" element={<MessagingSettingsPage />} />
              </Route>

              <Route element={<RequirePermission permission="tenant.switch" />}>
                <Route path="/schools" element={<SchoolsPage />} />
                <Route path="/schools/onboard" element={<SchoolOnboardingWizardPage />} />
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
                <Route path="/homework" element={<HomeworkPage />} />
                <Route path="/homework/:id" element={<HomeworkDetailPage />} />
              </Route>

              <Route element={<RequirePermission permission="reportcard.view" />}>
                <Route path="/report-cards" element={<ReportCardsPage />} />
                <Route path="/report-cards/:id" element={<ReportCardDetailPage />} />
                <Route path="/academic/grading-scales" element={<GradingScalesPage />} />
                <Route path="/academic/report-templates" element={<ReportCardTemplatesPage />} />
              </Route>

              <Route element={<RequirePermission permission="learner.view" />}>
                <Route path="/learners" element={<LearnersPage />} />
                <Route path="/learners/:id" element={<LearnerProfilePage />} />
                <Route path="/alumni" element={<AlumniPage />} />
              </Route>

              <Route element={<RequirePermission permission="admission.view" />}>
                <Route path="/admissions" element={<AdmissionsPage />} />
                <Route path="/admissions/requirements" element={<AdmissionRequirementsPage />} />
                <Route path="/admissions/:id" element={<AdmissionApplicationDetailPage />} />
              </Route>

              <Route element={<RequirePermission permission="timetable.view" />}>
                <Route path="/timetable" element={<TimetablePage />} />
              </Route>

              <Route element={<RequirePermission permission="guardian.view" />}>
                <Route path="/guardians" element={<GuardiansPage />} />
                <Route path="/guardians/:id" element={<GuardianProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="learner.view_safeguarding" />}>
                <Route path="/safeguarding" element={<SafeguardingOverviewPage />} />
              </Route>

              <Route element={<RequirePermission permission="employee.view" />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/attendance" element={<StaffAttendancePage />} />
                <Route path="/employees/leave" element={<LeaveRequestsPage />} />
                <Route path="/employees/departments" element={<DepartmentsPage />} />
                <Route path="/employees/:id" element={<EmployeeProfilePage />} />
              </Route>

              <Route element={<RequirePermission permission="attendance.view" />}>
                <Route path="/attendance" element={<AttendancePage />} />
              </Route>

              <Route element={<RequirePermission permission="learner.view_financial" />}>
                <Route path="/fees" element={<FinanceOverviewPage />} />
                <Route path="/fees/invoices" element={<InvoicesRegisterPage />} />
                <Route path="/fees/reconciliation" element={<BankReconciliationPage />} />
              </Route>
              <Route element={<RequirePermission permission="learner.manage_financial" />}>
                <Route path="/fees/structures" element={<FeeStructuresPage />} />
                <Route path="/fees/settings" element={<PaymentSettingsPage />} />
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
                <Route path="/parent/fees" element={<ParentFeesPage />} />
                <Route path="/parent/payment-return" element={<PaymentReturnPage />} />
                <Route path="/parent/profile" element={<ParentProfilePage />} />
                <Route path="/parent/notifications" element={<NotificationsPage />} />
                <Route path="/parent/notifications/settings" element={<NotificationSettingsPage />} />
                <Route path="/parent/announcements" element={<AnnouncementsPage />} />
                <Route path="/parent/messages" element={<MessagesPage basePath="/parent/messages" />} />
                <Route
                  path="/parent/messages/:conversationId"
                  element={<MessagesPage basePath="/parent/messages" />}
                />
                <Route path="/parent/homework" element={<ParentHomeworkPage />} />
                <Route path="/parent/homework/:assignmentId" element={<ParentHomeworkPage />} />
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
