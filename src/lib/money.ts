/**
 * Decimal-safe arithmetic for South African Rand amounts (2 decimal places
 * — cents). Every fee/charge/payment/adjustment/refund `amount` column is
 * Postgres `numeric`, which PostgREST serializes as a plain JS number —
 * meaning every sum/subtraction across a ledger of several rows was doing
 * IEEE 754 floating-point arithmetic on money (the classic `0.1 + 0.2 !==
 * 0.3` problem). At today's demo scale this rarely produces a
 * user-visible cent discrepancy, but it compounds as more rows are summed
 * and becomes real, disputable, and reputationally costly the moment a
 * live payment gateway exists (FND-PAY-001) — this module is the P0 gate
 * FND-FIN-009 closes before that.
 *
 * No external decimal library is pulled in: converting to integer cents
 * (exact in JS for any realistic school-fee amount, far below
 * Number.MAX_SAFE_INTEGER) and doing the arithmetic as integers is
 * sufficient and simpler than a general-purpose arbitrary-precision
 * decimal type would be for a fixed 2-decimal-place currency.
 */

/** Rand amount → integer cents. Rounds to the nearest cent — the same rounding a `numeric(*, 2)` column already enforces at write time, so this never disagrees with what the database actually stored. */
export function toCents(rand: number): number {
  return Math.round(rand * 100);
}

/** Integer cents → Rand amount. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Sums any number of Rand amounts without floating-point drift — the decimal-safe replacement for `amounts.reduce((sum, a) => sum + a, 0)`. */
export function sumMoney(amounts: readonly number[]): number {
  return fromCents(amounts.reduce((sum, amount) => sum + toCents(amount), 0));
}

/** a - b, decimal-safe. */
export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/** a + b, decimal-safe. */
export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}
