import { describe, expect, it } from 'vitest';
import { canRevoke, grantState, scopeLabels } from './grantState';

const now = new Date('2026-10-24T12:00:00Z');

describe('grantState', () => {
  it('treats an approved grant as active only until it expires', () => {
    expect(grantState({ status: 'approved', expires_at: '2026-10-24T13:00:00Z' }, now)).toBe(
      'active',
    );
    expect(grantState({ status: 'approved', expires_at: '2026-10-24T11:59:59Z' }, now)).toBe(
      'expired',
    );
    expect(grantState({ status: 'approved', expires_at: null }, now)).toBe('expired');
  });

  it('passes other statuses through', () => {
    expect(grantState({ status: 'pending', expires_at: null }, now)).toBe('pending');
    expect(grantState({ status: 'declined', expires_at: null }, now)).toBe('declined');
    expect(grantState({ status: 'revoked', expires_at: '2026-10-24T13:00:00Z' }, now)).toBe(
      'revoked',
    );
  });
});

describe('canRevoke', () => {
  it('allows withdrawing waiting and open grants only', () => {
    expect(canRevoke('pending')).toBe(true);
    expect(canRevoke('active')).toBe(true);
    expect(canRevoke('expired')).toBe(false);
    expect(canRevoke('declined')).toBe(false);
    expect(canRevoke('revoked')).toBe(false);
  });
});

describe('scopeLabels', () => {
  it('names the areas in plain words', () => {
    expect(scopeLabels(['safeguarding', 'messages'])).toBe('Safeguarding concerns, Messages');
  });
});
