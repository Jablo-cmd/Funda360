import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address linked to your account and we'll send you a reset link."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
