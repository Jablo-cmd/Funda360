import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/authContext';
import { hasPermission } from '@/features/rbac';
import type { Permission } from '@/features/rbac';

export interface RequirePermissionProps {
  permission: Permission;
}

/** Route-level RBAC gate — redirects to /dashboard if the signed-in user lacks the given permission. */
export function RequirePermission({ permission }: RequirePermissionProps) {
  const { user } = useAuth();

  if (!hasPermission(user?.role ?? null, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
