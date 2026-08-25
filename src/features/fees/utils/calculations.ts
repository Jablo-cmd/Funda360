/**
 * Centralized fee-ledger calculations — matches the assessments/attendance
 * features' own "do not duplicate calculation logic throughout the UI"
 * convention. The fees domain uses a ledger model (see the fees_domain
 * migration): no stored balance/status anywhere, computed here from the raw
 * charge/payment rows so there is exactly one place this arithmetic lives.
 */

import type { LearnerFeeCharge, LearnerFeePayment, FeeStatus, LearnerFeeSummary } from '@/features/fees/types/fee.types';

/**
 * Status precedence: Overdue takes priority over Partially Paid whenever
 * there's still a balance and at least one unpaid charge is past its due
 * date — a learner who has paid something but is still overdue is still
 * overdue, not merely "partially paid".
 */
export function deriveFeeStatus(charges: LearnerFeeCharge[], payments: LearnerFeePayment[], today: string): FeeStatus {
  const totalCharged = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingBalance = Math.max(0, totalCharged - totalPaid);

  if (outstandingBalance <= 0 && totalCharged > 0) return 'paid';

  const hasOverdueCharge = outstandingBalance > 0 && charges.some((charge) => charge.dueDate !== null && charge.dueDate < today);
  if (hasOverdueCharge) return 'overdue';

  if (totalPaid > 0) return 'partially_paid';

  return 'outstanding';
}

export function buildFeeSummary(charges: LearnerFeeCharge[], payments: LearnerFeePayment[], today: string): LearnerFeeSummary {
  const totalCharged = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingBalance = Math.max(0, totalCharged - totalPaid);
  const status = deriveFeeStatus(charges, payments, today);

  // payments are already sorted most-recent-first by the service.
  const lastPayment = payments[0] ?? null;

  return { totalCharged, totalPaid, outstandingBalance, status, lastPayment, charges, payments };
}
