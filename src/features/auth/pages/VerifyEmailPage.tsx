import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { useAuth } from '@/features/auth/context/authContext';
import { getAuthErrorMessage } from '@/features/auth/utils/authErrors';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';

const RESEND_COOLDOWN_SECONDS = 30;

export function VerifyEmailPage() {
  const { status, user, resendVerificationEmail, signOut } = useAuth();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  if (status === 'initializing') {
    return <FullScreenSpinner />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (user?.emailVerified) {
    return <Navigate to="/" replace />;
  }

  const handleResend = async () => {
    setFeedback(null);
    setIsSending(true);
    try {
      await resendVerificationEmail();
      setFeedback({ type: 'success', message: 'Verification email sent. Please check your inbox.' });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setFeedback({ type: 'error', message: getAuthErrorMessage(error) });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`We sent a verification link to ${user?.email ?? 'your email address'}. Please confirm it to continue.`}
    >
      <div className="flex flex-col gap-5">
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={
              feedback.type === 'error'
                ? 'rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600'
                : 'rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500'
            }
          >
            {feedback.message}
          </div>
        )}

        <Button
          type="button"
          onClick={handleResend}
          isLoading={isSending}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
        </Button>

        <Button type="button" variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
