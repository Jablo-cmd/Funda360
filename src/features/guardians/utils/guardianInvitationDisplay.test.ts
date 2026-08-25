import { describe, expect, it } from 'vitest';
import { deriveGuardianInvitationDisplayStatus } from '@/features/guardians/utils/guardianInvitationDisplay';

const NOW = new Date('2026-08-24T12:00:00Z');

describe('deriveGuardianInvitationDisplayStatus', () => {
  it('passes accepted through unchanged', () => {
    expect(deriveGuardianInvitationDisplayStatus('accepted', '2026-08-20T00:00:00Z', NOW)).toBe('accepted');
  });

  it('passes revoked through unchanged, even if its stored expiry is in the future', () => {
    expect(deriveGuardianInvitationDisplayStatus('revoked', '2026-09-01T00:00:00Z', NOW)).toBe('revoked');
  });

  it('reports pending when the invitation has not yet expired', () => {
    expect(deriveGuardianInvitationDisplayStatus('pending', '2026-08-25T00:00:00Z', NOW)).toBe('pending');
  });

  it('derives expired for a pending invitation whose expiry has passed', () => {
    expect(deriveGuardianInvitationDisplayStatus('pending', '2026-08-23T00:00:00Z', NOW)).toBe('expired');
  });

  it('treats an expiry of exactly now as not yet expired (strict less-than)', () => {
    expect(deriveGuardianInvitationDisplayStatus('pending', NOW.toISOString(), NOW)).toBe('pending');
  });
});
