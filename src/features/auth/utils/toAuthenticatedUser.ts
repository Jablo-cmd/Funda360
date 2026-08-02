import type { User } from '@supabase/supabase-js';
import { USER_ROLES } from '@/features/auth/types/auth.types';
import type { AuthenticatedUser, UserRole } from '@/features/auth/types/auth.types';

function parseRole(value: unknown): UserRole | null {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
    ? (value as UserRole)
    : null;
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    role: parseRole(user.app_metadata?.role),
    tenantId: typeof user.app_metadata?.tenant_id === 'string' ? user.app_metadata.tenant_id : null,
  };
}
