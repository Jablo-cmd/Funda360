import type { AuthenticatedUser } from '@/features/auth/types/auth.types';
import type { UserProfile } from '@/types/profile.types';
import type { Tenant } from '@/types/tenant.types';

/**
 * The full authenticated picture: who (auth identity + role), what
 * (profile details), and where (active tenant). Composed from the
 * Auth/Profile/Tenant providers — not itself backed by a single provider.
 */
export interface Session {
  user: AuthenticatedUser;
  profile: UserProfile | null;
  tenant: Tenant | null;
}
