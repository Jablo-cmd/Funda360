import { describe, expect, it } from 'vitest';
import { isValidSaIdChecksum } from './saIdNumber';

describe('isValidSaIdChecksum', () => {
  it('accepts a well-formed 13-digit number with a correct checksum', () => {
    expect(isValidSaIdChecksum('9001015000085')).toBe(true);
  });

  it('rejects the same number with a single-digit checksum error', () => {
    expect(isValidSaIdChecksum('9001015000086')).toBe(false);
  });

  it('rejects a number that is not 13 digits', () => {
    expect(isValidSaIdChecksum('900101500008')).toBe(false);
    expect(isValidSaIdChecksum('90010150000855')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(isValidSaIdChecksum('900101A00085')).toBe(false);
    expect(isValidSaIdChecksum('')).toBe(false);
  });
});
