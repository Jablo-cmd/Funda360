import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';

/**
 * Route-level gate for the Learner Portal (/learner/*). Like
 * RequireGuardianRole, this checks role membership directly rather than a
 * Permission — learner capabilities are self-scoped by is_learner_self()
 * at the RLS layer, not a granted Permission. Frontend gating is
 * defense-in-depth only; RLS is what actually enforces that a learner can
 * never see another learner's data.
 */
export function RequireLearnerRole() {
  const { user } = useAuth();

  if (!user || user.role !== 'learner') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
