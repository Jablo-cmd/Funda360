import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';

const GUARDIAN_ROLES = new Set(['parent', 'guardian']);

/**
 * Wraps the two staff routes that historically had no RequirePermission
 * guard at all (/dashboard, /my-profile — see RequirePermission usage in
 * AppRoutes.tsx) — every other staff route is already safe from guardians
 * today, since ROLE_PERMISSIONS['parent'/'guardian'] is an empty array and
 * RequirePermission denies by default. Without this, a guardian landing on
 * /dashboard would see a broken, empty staff dashboard (every staff hook it
 * calls returns nothing under RLS, but the page still renders) instead of
 * their own Parent Portal.
 */
export function RedirectGuardiansToParentPortal() {
  const { user } = useAuth();

  if (user && GUARDIAN_ROLES.has(user.role ?? '')) {
    return <Navigate to="/parent/dashboard" replace />;
  }

  return <Outlet />;
}
