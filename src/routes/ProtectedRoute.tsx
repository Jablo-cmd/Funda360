import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';

/** Gate for routes that require a signed-in, email-verified user. */
export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <FullScreenSpinner label="Loading your session…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}
