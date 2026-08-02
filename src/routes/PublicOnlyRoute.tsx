import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';

interface LocationState {
  from?: { pathname?: string };
}

/** Gate for guest-only routes (login, forgot password) — signed-in users are redirected away. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'initializing') {
    return <FullScreenSpinner />;
  }

  if (status === 'authenticated') {
    const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}
