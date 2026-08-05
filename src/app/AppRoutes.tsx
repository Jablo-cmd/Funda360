import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute';
import { TenantGate } from '@/routes/TenantGate';
import { RequirePermission } from '@/routes/RequirePermission';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { SchoolProfilePage } from '@/features/school/pages/SchoolProfilePage';
import { UsersPage } from '@/features/users/pages/UsersPage';
import { UserProfilePage } from '@/features/users/pages/UserProfilePage';
import { AcademicOverviewPage } from '@/features/academic/pages/AcademicOverviewPage';
import { AcademicYearsPage } from '@/features/academic/pages/AcademicYearsPage';
import { TermsPage } from '@/features/academic/pages/TermsPage';
import { GradesPage } from '@/features/academic/pages/GradesPage';
import { ClassesPage } from '@/features/academic/pages/ClassesPage';
import { SubjectsPage } from '@/features/academic/pages/SubjectsPage';
import { LearnersPage } from '@/features/learners/pages/LearnersPage';
import { LearnerProfilePage } from '@/features/learners/pages/LearnerProfilePage';
import { EmployeesPage } from '@/features/employees/pages/EmployeesPage';
import { EmployeeProfilePage } from '@/features/employees/pages/EmployeeProfilePage';
import { DepartmentsPage } from '@/features/employees/pages/DepartmentsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<TenantGate />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/school/profile" element={<SchoolProfilePage />} />

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
            </Route>

            <Route element={<RequirePermission permission="learner.view" />}>
              <Route path="/learners" element={<LearnersPage />} />
              <Route path="/learners/:id" element={<LearnerProfilePage />} />
            </Route>

            <Route element={<RequirePermission permission="employee.view" />}>
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/departments" element={<DepartmentsPage />} />
              <Route path="/employees/:id" element={<EmployeeProfilePage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
