import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute';
import { TenantGate } from '@/routes/TenantGate';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { HomePlaceholderPage } from '@/pages/HomePlaceholderPage';

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
          <Route path="/" element={<HomePlaceholderPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
