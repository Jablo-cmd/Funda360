import type { UserRole } from '@/features/auth/types/auth.types';

/** Mirrors the `profile_status` Postgres enum. */
export type ProfileStatus = 'active' | 'inactive' | 'suspended';

/** Raw shape of a `profiles` row — personal/contact details, scoped to a tenant. */
export interface Profile {
  id: string;
  tenantId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * The UI-facing "current user" view: a Profile enriched with the two fields
 * that live in the JWT rather than the profiles table (role, emailVerified —
 * see auth.types.ts for why those aren't columns here).
 */
export interface UserProfile extends Profile {
  role: UserRole | null;
  emailVerified: boolean;
}
