import { describe, expect, it } from 'vitest';
import { guardianRelationshipSummary, guardianSecondaryBadges, relationshipLabel } from '@/features/guardians/utils/guardianDisplay';

describe('relationshipLabel', () => {
  it('maps known relationship types to their display label', () => {
    expect(relationshipLabel('legal_guardian')).toBe('Legal guardian');
    expect(relationshipLabel('mother')).toBe('Mother');
  });
});

describe('guardianRelationshipSummary', () => {
  it('shows just the relationship for a non-primary guardian', () => {
    expect(
      guardianRelationshipSummary({
        relationshipType: 'father',
        isPrimary: false,
        isEmergencyContact: false,
        isAuthorizedPickup: false,
      }),
    ).toBe('Father');
  });

  it('appends "Primary Guardian" for the primary guardian', () => {
    expect(
      guardianRelationshipSummary({
        relationshipType: 'mother',
        isPrimary: true,
        isEmergencyContact: false,
        isAuthorizedPickup: false,
      }),
    ).toBe('Mother · Primary Guardian');
  });
});

describe('guardianSecondaryBadges', () => {
  it('returns no badges when neither flag is set', () => {
    expect(
      guardianSecondaryBadges({ relationshipType: 'mother', isPrimary: true, isEmergencyContact: false, isAuthorizedPickup: false }),
    ).toEqual([]);
  });

  it('returns both badges when both flags are set', () => {
    expect(
      guardianSecondaryBadges({ relationshipType: 'mother', isPrimary: true, isEmergencyContact: true, isAuthorizedPickup: true }),
    ).toEqual(['Emergency contact', 'Authorised pickup']);
  });

  it('returns only the relevant badge when one flag is set', () => {
    expect(
      guardianSecondaryBadges({ relationshipType: 'father', isPrimary: false, isEmergencyContact: false, isAuthorizedPickup: true }),
    ).toEqual(['Authorised pickup']);
  });
});
