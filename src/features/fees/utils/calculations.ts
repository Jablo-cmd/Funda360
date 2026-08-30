/**
 * Centralized fee-ledger calculations — matches the assessments/attendance
 * features' own "do not duplicate calculation logic throughout the UI"
 * convention. The fees domain uses a ledger model (see the fees_domain
 * migration): no stored balance/status anywhere, computed here from the raw
 * charge/payment/adjustment/refund rows so there is exactly one place this
 * arithmetic lives.
 */

import type {
  LearnerFeeCharge,
  LearnerFeePayment,
  LearnerFeeAdjustment,
  LearnerFeeRefund,
  FeeStatus,
  LearnerFeeSummary,
} from '@/features/fees/types/fee.types';
import { sumMoney, subtractMoney } from '@/lib/money';

/** Sum of payments actually received, net of any completed refunds. A pending or rejected refund has no financial effect yet — see learner_fee_refunds_validate_tenant() for why only 'completed' counts. Decimal-safe (FND-FIN-009) — see src/lib/money.ts. */
export function calculateNetPaid(payments: LearnerFeePayment[], refunds: LearnerFeeRefund[]): number {
  const totalPaid = sumMoney(payments.map((payment) => payment.amount));
  const totalRefunded = sumMoney(refunds.filter((refund) => refund.status === 'completed').map((refund) => refund.amount));
  return subtractMoney(totalPaid, totalRefunded);
}

/**
 * Status precedence: Overdue takes priority over Partially Paid whenever
 * there's still a balance and at least one unpaid charge is past its due
 * date — a learner who has paid something but is still overdue is still
 * overdue, not merely "partially paid".
 */
export function deriveFeeStatus(
  charges: LearnerFeeCharge[],
  payments: LearnerFeePayment[],
  adjustments: LearnerFeeAdjustment[],
  refunds: LearnerFeeRefund[],
  today: string,
): FeeStatus {
  const totalCharged = sumMoney(charges.map((charge) => charge.amount));
  const totalAdjustments = sumMoney(adjustments.map((adjustment) => adjustment.amount));
  const netPaid = calculateNetPaid(payments, refunds);
  const outstandingBalance = Math.max(0, subtractMoney(subtractMoney(totalCharged, totalAdjustments), netPaid));

  if (outstandingBalance <= 0 && totalCharged > 0) return 'paid';

  const hasOverdueCharge = outstandingBalance > 0 && charges.some((charge) => charge.dueDate !== null && charge.dueDate < today);
  if (hasOverdueCharge) return 'overdue';

  if (netPaid > 0) return 'partially_paid';

  return 'outstanding';
}

export function buildFeeSummary(
  charges: LearnerFeeCharge[],
  payments: LearnerFeePayment[],
  adjustments: LearnerFeeAdjustment[],
  refunds: LearnerFeeRefund[],
  today: string,
): LearnerFeeSummary {
  const totalCharged = sumMoney(charges.map((charge) => charge.amount));
  const totalAdjustments = sumMoney(adjustments.map((adjustment) => adjustment.amount));
  const totalPaid = sumMoney(payments.map((payment) => payment.amount));
  const totalRefunded = sumMoney(refunds.filter((refund) => refund.status === 'completed').map((refund) => refund.amount));
  const netPaid = subtractMoney(totalPaid, totalRefunded);
  const outstandingBalance = Math.max(0, subtractMoney(subtractMoney(totalCharged, totalAdjustments), netPaid));
  const status = deriveFeeStatus(charges, payments, adjustments, refunds, today);

  // payments are already sorted most-recent-first by the service.
  const lastPayment = payments[0] ?? null;

  return {
    totalCharged,
    totalAdjustments,
    totalPaid,
    totalRefunded,
    netPaid,
    outstandingBalance,
    status,
    lastPayment,
    charges,
    payments,
    adjustments,
    refunds,
  };
}

/**
 * Net collected against billed, after discounts/bursaries/scholarships —
 * the same formula FinanceOverviewPage already renders, extracted here
 * (FND-AN-002) so the Dashboard's executive-KPI card can show the
 * identical number rather than a second, independently-drifting copy of
 * this arithmetic. Null (not 0) when nothing has been billed yet — a
 * school with no charges on file has no collection rate to report, not a
 * 0% one.
 */
export function calculateCollectionRate(overview: { totalCharged: number; totalAdjustments: number; netPaid: number }): number | null {
  const billedAfterAdjustments = subtractMoney(overview.totalCharged, overview.totalAdjustments);
  if (billedAfterAdjustments <= 0) return null;
  return Math.round((overview.netPaid / billedAfterAdjustments) * 100);
}
