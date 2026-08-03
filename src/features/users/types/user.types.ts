import type { UserRole } from '@/features/auth/types/auth.types';
import type { Profile, ProfileStatus } from '@/types/profile.types';

/**
 * Roles assignable through the User Management UI — a deliberate subset of
 * the full RBAC catalogue (RBAC spec §6), matching the Milestone 5 brief.
 * "School Administrator" is the display label for the existing
 * `school_owner` role, not a new one — see ASSIGNABLE_ROLE_LABELS.
 */
export const ASSIGNABLE_ROLES = ['school_owner', 'principal', 'teacher'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ASSIGNABLE_ROLE_LABELS: Record<AssignableRole, string> = {
  school_owner: 'School Administrator',
  principal: 'Principal',
  teacher: 'Teacher',
};

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: AssignableRole;
}

export interface CreateUserResult {
  userId: string;
  temporaryPassword: string;
}

export interface UsersListFilters {
  search?: string;
  role?: UserRole;
  status?: ProfileStatus;
}

export interface UsersListPage {
  users: Profile[];
  totalCount: number;
  page: number;
  pageSize: number;
}
