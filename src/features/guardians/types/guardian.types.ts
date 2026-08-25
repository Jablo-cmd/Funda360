import type { GuardianRelationshipType } from '@/features/learners/types/learner.types';
import type { ProfileStatus } from '@/types/profile.types';

/**
 * 'not_invited' has no corresponding row in guardian_invitations — it's the
 * absence of one. 'expired' has no stored status either (see the
 * guardian_invitation_status enum's comment in the migration) — it's
 * derived by comparing a 'pending' row's expiresAt to now(), same
 * computation the get_my_guardian_invitation() RPC does server-side.
 */
export type GuardianInvitationDisplayStatus = 'not_invited' | 'pending' | 'expired' | 'revoked' | 'accepted';

export interface GuardianInvitation {
  id: string;
  guardianProfileId: string;
  status: 'pending' | 'accepted' | 'revoked';
  displayStatus: GuardianInvitationDisplayStatus;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface GuardianLearnerLink {
  relationshipId: string;
  learnerId: string;
  learnerFirstName: string;
  learnerLastName: string;
  relationshipType: GuardianRelationshipType;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
  custodyNotes: string | null;
  active: boolean;
}

export interface GuardianDirectoryEntry {
  guardianProfileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: ProfileStatus;
  links: GuardianLearnerLink[];
  /** Most recent invitation, if one was ever sent — null means "Not Invited". */
  invitation: GuardianInvitation | null;
}

export interface GuardianProfileDetail extends GuardianDirectoryEntry {
  address: string | null;
  idNumber: string | null;
}

export interface GuardiansListFilters {
  search?: string;
  learnerId?: string;
  relationshipType?: GuardianRelationshipType;
}

export interface CreateGuardianDirectoryInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  idNumber?: string | null;
}

export interface UpdateGuardianDetailsInput {
  address?: string | null;
  idNumber?: string | null;
}
