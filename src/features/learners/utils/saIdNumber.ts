/**
 * South African ID number checksum validation (Luhn-style, the standard
 * SA ID algorithm) — checksum only, not full validation (embedded-date
 * cross-checking, citizenship-digit interpretation). This matches the
 * validation depth already decided during Employee Management's
 * architecture lock: enough to catch fat-fingered/fabricated numbers,
 * without requiring cross-field logic that isn't needed for anything this
 * milestone does.
 *
 * Nullable/optional by design at the call site — foreign/work-permit
 * holders won't have a valid SA ID number.
 */
export function isValidSaIdChecksum(idNumber: string): boolean {
  if (!/^\d{13}$/.test(idNumber)) return false;

  const digits = idNumber.split('').map(Number) as number[];

  const oddSum = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]! + digits[10]!;

  const evenDigits = `${digits[1]}${digits[3]}${digits[5]}${digits[7]}${digits[9]}${digits[11]}`;
  const evenDoubled = String(Number(evenDigits) * 2);
  const evenSum = evenDoubled.split('').reduce((sum, digit) => sum + Number(digit), 0);

  const checkDigit = (10 - ((oddSum + evenSum) % 10)) % 10;

  return checkDigit === digits[12];
}
