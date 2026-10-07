import { describe, expect, it } from 'vitest';
import { parseEmailLinkToken, stripEmailLinkToken } from '@/features/auth/utils/emailLink';

describe('parseEmailLinkToken', () => {
  it('reads a recovery token hash', () => {
    expect(parseEmailLinkToken('?token_hash=abc123&type=recovery')).toEqual({
      tokenHash: 'abc123',
      type: 'recovery',
    });
  });

  it('ignores links without a token hash or with an unknown type', () => {
    expect(parseEmailLinkToken('')).toBeNull();
    expect(parseEmailLinkToken('?code=xyz')).toBeNull();
    expect(parseEmailLinkToken('?token_hash=abc')).toBeNull();
    expect(parseEmailLinkToken('?token_hash=abc&type=sms')).toBeNull();
  });
});

describe('stripEmailLinkToken', () => {
  it('removes only the token parameters', () => {
    expect(stripEmailLinkToken('?token_hash=abc&type=recovery')).toBe('');
    expect(stripEmailLinkToken('?token_hash=abc&type=recovery&tab=2')).toBe('?tab=2');
  });
});
