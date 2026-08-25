import type { GuardianRelationshipType } from '@/features/learners/types/learner.types';

export const RELATIONSHIP_LABELS: Record<GuardianRelationshipType, string> = {
  mother: 'Mother',
  father: 'Father',
  legal_guardian: 'Legal guardian',
  grandparent: 'Grandparent',
  sibling: 'Sibling',
  other: 'Other',
};

export function relationshipLabel(relationshipType: GuardianRelationshipType): string {
  return RELATIONSHIP_LABELS[relationshipType] ?? relationshipType;
}

export interface GuardianRelationshipBadgeInputs {
  relationshipType: GuardianRelationshipType;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
}

/**
 * The single "Mother · Primary Guardian" style summary line used everywhere
 * a guardian's relationship is displayed (Learner 360 overview card, the
 * per-learner guardians table, and the guardian directory) — one place this
 * formatting lives, not re-derived per component.
 */
export function guardianRelationshipSummary(inputs: GuardianRelationshipBadgeInputs): string {
  const parts = [relationshipLabel(inputs.relationshipType)];
  if (inputs.isPrimary) parts.push('Primary Guardian');
  return parts.join(' · ');
}

/** Secondary badges (emergency contact / authorised pickup) shown alongside the relationship summary. */
export function guardianSecondaryBadges(inputs: GuardianRelationshipBadgeInputs): string[] {
  const badges: string[] = [];
  if (inputs.isEmergencyContact) badges.push('Emergency contact');
  if (inputs.isAuthorizedPickup) badges.push('Authorised pickup');
  return badges;
}
