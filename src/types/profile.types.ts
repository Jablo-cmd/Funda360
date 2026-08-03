import type { UserRole } from '@/features/auth/types/auth.types';

/** Mirrors the `profile_status` Postgres enum. */
export type ProfileStatus = 'active' | 'inactive' | 'suspended';

/**
 * Raw shape of a `profiles` row — personal/contact details, scoped to a
 * tenant. `role` (added in Milestone 5) is a denormalized mirror of the JWT
 * `app_metadata.role` claim — see supabase/migrations for why it exists
 * and why it's never the authorization source of truth.
 */
export interface Profile {
  id: string;
  tenantId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole | null;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * The UI-facing "current user" view: a Profile plus the one field that
 * lives only in the JWT (email verification isn't tracked in the profiles
 * table at all). For the *authenticated* user, `role` is still populated
 * from the JWT claim directly in AuthProvider/ProfileProvider, taking
 * precedence over this same field's DB-mirrored value.
 */
export interface UserProfile extends Profile {
  emailVerified: boolean;
}
