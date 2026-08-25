import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';

const GUARDIAN_ROLES = new Set(['parent', 'guardian']);

/**
 * Route-level gate for the Parent Portal (/parent/*). Unlike RequirePermission,
 * this checks role membership directly rather than a Permission — guardian
 * capabilities are a different shape from the staff RBAC model (self-scoped
 * by is_learner_guardian() at the RLS layer, not a granted Permission), so
 * mixing them into ROLE_PERMISSIONS would blur two different authorization
 * models. Frontend gating is defense-in-depth only; RLS is what actually
 * enforces a guardian can never see another guardian's data even if this
 * check were somehow bypassed.
 */
export function RequireGuardianRole() {
  const { user } = useAuth();

  if (!user || !GUARDIAN_ROLES.has(user.role ?? '')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
