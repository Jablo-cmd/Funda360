/**
 * Builds a chronological account statement from the raw fee ledger rows —
 * the same charge/payment/adjustment/refund rows the balance calculation
 * in calculations.ts uses, presented as a running-balance transaction
 * list. One place this arithmetic lives (matches the calculations.ts
 * convention). Decimal-safe via src/lib/money.ts.
 */

import type {
  LearnerFeeCharge,
  LearnerFeePayment,
  LearnerFeeAdjustment,
  LearnerFeeRefund,
} from '@/features/fees/types/fee.types';
import type { AccountStatement, StatementEntry } from '@/features/fees/types/invoice.types';
import { addMoney, subtractMoney } from '@/lib/money';

const CATEGORY_LABELS: Record<string, string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Fees',
};

const ADJUSTMENT_LABELS: Record<string, string> = {
  discount: 'Discount',
  bursary: 'Bursary',
  scholarship: 'Scholarship',
  waiver: 'Waiver',
};

interface StatementInput {
  charges: LearnerFeeCharge[];
  payments: LearnerFeePayment[];
  adjustments: LearnerFeeAdjustment[];
  refunds: LearnerFeeRefund[];
  /** ISO date (YYYY-MM-DD) — entries dated after this are excluded; ageing is measured from here. */
  asOf: string;
}

function ageColumn(daysOverdue: number): keyof AccountStatement['ageing'] {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'current';
  if (daysOverdue <= 60) return 'days30';
  if (daysOverdue <= 90) return 'days60';
  if (daysOverdue <= 120) return 'days90';
  return 'days120Plus';
}

export function buildAccountStatement(input: StatementInput): AccountStatement {
  const { charges, payments, adjustments, refunds, asOf } = input;

  type Raw = Omit<StatementEntry, 'runningBalance'> & { sortKey: string };
  const raw: Raw[] = [];

  for (const charge of charges) {
    const date = charge.dueDate ?? charge.createdAt.slice(0, 10);
    raw.push({
      date,
      sortKey: `${date}-1-${charge.id}`,
      type: 'charge',
      description: `${CATEGORY_LABELS[charge.category] ?? 'Fees'} — ${charge.description}`,
      reference: null,
      debit: charge.amount,
      credit: 0,
    });
  }

  for (const adjustment of adjustments) {
    const date = adjustment.createdAt.slice(0, 10);
    raw.push({
      date,
      sortKey: `${date}-2-${adjustment.id}`,
      type: 'adjustment',
      description: `${ADJUSTMENT_LABELS[adjustment.adjustmentType] ?? 'Adjustment'} — ${adjustment.reason}`,
      reference: null,
      debit: 0,
      credit: adjustment.amount,
    });
  }

  for (const payment of payments) {
    raw.push({
      date: payment.paymentDate,
      sortKey: `${payment.paymentDate}-3-${payment.id}`,
      type: 'payment',
      description: `Payment received (${payment.method.toUpperCase()})`,
      reference: payment.reference,
      debit: 0,
      credit: payment.amount,
    });
  }

  // Only a completed refund moves the account — it reverses a payment, so
  // the balance owed goes back up (debit).
  for (const refund of refunds) {
    if (refund.status !== 'completed') continue;
    raw.push({
      date: refund.refundDate,
      sortKey: `${refund.refundDate}-4-${refund.id}`,
      type: 'refund',
      description: `Refund — ${refund.reason}`,
      reference: refund.reference,
      debit: refund.amount,
      credit: 0,
    });
  }

  const visible = raw.filter((entry) => entry.date <= asOf).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let running = 0;
  const entries: StatementEntry[] = visible.map((entry) => {
    running = subtractMoney(addMoney(running, entry.debit), entry.credit);
    return {
      date: entry.date,
      type: entry.type,
      description: entry.description,
      reference: entry.reference,
      debit: entry.debit,
      credit: entry.credit,
      runningBalance: running,
    };
  });

  const closingBalance = running;

  // Ageing: distribute the (positive) closing balance across buckets by the
  // age of the oldest unsettled charge due date. FIFO — payments settle the
  // oldest charges first.
  const ageing = { current: 0, days30: 0, days60: 0, days90: 0, days120Plus: 0 };
  if (closingBalance > 0) {
    const totalCredits = subtractMoney(
      addMoney(
        payments.reduce((sum, p) => addMoney(sum, p.paymentDate <= asOf ? p.amount : 0), 0),
        adjustments.reduce((sum, a) => addMoney(sum, a.createdAt.slice(0, 10) <= asOf ? a.amount : 0), 0),
      ),
      refunds.filter((r) => r.status === 'completed' && r.refundDate <= asOf).reduce((sum, r) => addMoney(sum, r.amount), 0),
    );

    let creditRemaining = totalCredits;
    const dueCharges = charges
      .filter((c) => (c.dueDate ?? c.createdAt.slice(0, 10)) <= asOf)
      .map((c) => ({ amount: c.amount, due: c.dueDate ?? c.createdAt.slice(0, 10) }))
      .sort((a, b) => a.due.localeCompare(b.due));

    for (const charge of dueCharges) {
      let unpaid = charge.amount;
      if (creditRemaining > 0) {
        const applied = Math.min(creditRemaining, unpaid);
        creditRemaining = subtractMoney(creditRemaining, applied);
        unpaid = subtractMoney(unpaid, applied);
      }
      if (unpaid <= 0) continue;
      const daysOverdue = Math.floor((Date.parse(asOf) - Date.parse(charge.due)) / 86_400_000);
      const col = ageColumn(daysOverdue);
      ageing[col] = addMoney(ageing[col], unpaid);
    }

    // Any residual (e.g. balance from charges with no due date treatment) → current.
    const bucketed = ageing.current + ageing.days30 + ageing.days60 + ageing.days90 + ageing.days120Plus;
    if (bucketed < closingBalance) {
      ageing.current = addMoney(ageing.current, subtractMoney(closingBalance, bucketed));
    }
  }

  return { openingBalance: 0, closingBalance, entries, ageing };
}
