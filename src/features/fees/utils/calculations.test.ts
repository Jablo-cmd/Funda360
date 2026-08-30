import { describe, expect, it } from 'vitest';
import { deriveFeeStatus, buildFeeSummary, calculateNetPaid, calculateCollectionRate } from './calculations';
import type { LearnerFeeCharge, LearnerFeePayment, LearnerFeeAdjustment, LearnerFeeRefund } from '@/features/fees/types/fee.types';

const TODAY = '2026-06-15';

function charge(overrides: Partial<LearnerFeeCharge> = {}): LearnerFeeCharge {
  return {
    id: 'charge-1',
    schoolId: 'school-1',
    learnerId: 'learner-1',
    academicYearId: 'year-1',
    feeStructureId: null,
    description: 'Term 1 Tuition',
    category: 'tuition',
    amount: 1000,
    dueDate: null,
    notes: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function payment(overrides: Partial<LearnerFeePayment> = {}): LearnerFeePayment {
  return {
    id: 'payment-1',
    schoolId: 'school-1',
    learnerId: 'learner-1',
    academicYearId: 'year-1',
    amount: 500,
    paymentDate: '2026-02-01',
    method: 'eft',
    reference: null,
    notes: null,
    active: true,
    reconciledAt: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

function adjustment(overrides: Partial<LearnerFeeAdjustment> = {}): LearnerFeeAdjustment {
  return {
    id: 'adjustment-1',
    schoolId: 'school-1',
    learnerId: 'learner-1',
    academicYearId: 'year-1',
    chargeId: null,
    adjustmentType: 'discount',
    method: 'fixed_amount',
    percentage: null,
    amount: 100,
    reason: 'Sibling discount',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function refund(overrides: Partial<LearnerFeeRefund> = {}): LearnerFeeRefund {
  return {
    id: 'refund-1',
    schoolId: 'school-1',
    learnerId: 'learner-1',
    academicYearId: 'year-1',
    paymentId: 'payment-1',
    amount: 200,
    refundDate: '2026-03-01',
    method: 'eft',
    reference: null,
    reason: 'Overpayment',
    status: 'completed',
    active: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

describe('calculateNetPaid', () => {
  it('equals total payments when there are no refunds', () => {
    expect(calculateNetPaid([payment({ amount: 500 })], [])).toBe(500);
  });

  it('subtracts only completed refunds', () => {
    const refunds = [refund({ amount: 200, status: 'completed' }), refund({ id: 'refund-2', amount: 300, status: 'pending' })];
    expect(calculateNetPaid([payment({ amount: 500 })], refunds)).toBe(300);
  });

  it('ignores rejected refunds entirely', () => {
    expect(calculateNetPaid([payment({ amount: 500 })], [refund({ status: 'rejected' })])).toBe(500);
  });
});

describe('deriveFeeStatus', () => {
  it('returns outstanding when charges exist and nothing has been paid', () => {
    expect(deriveFeeStatus([charge()], [], [], [], TODAY)).toBe('outstanding');
  });

  it('returns paid when payments cover the full charged amount', () => {
    expect(deriveFeeStatus([charge({ amount: 1000 })], [payment({ amount: 1000 })], [], [], TODAY)).toBe('paid');
  });

  it('returns paid when payments exceed the charged amount (credit balance)', () => {
    expect(deriveFeeStatus([charge({ amount: 1000 })], [payment({ amount: 1200 })], [], [], TODAY)).toBe('paid');
  });

  it('returns partially_paid when some but not all of the balance has been paid, and no charge is overdue', () => {
    expect(
      deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-12-31' })], [payment({ amount: 400 })], [], [], TODAY),
    ).toBe('partially_paid');
  });

  it('returns overdue when a balance remains and a charge is past its due date', () => {
    expect(deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-01-01' })], [], [], [], TODAY)).toBe('overdue');
  });

  it('prioritizes overdue over partially_paid when both conditions hold', () => {
    expect(
      deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-01-01' })], [payment({ amount: 400 })], [], [], TODAY),
    ).toBe('overdue');
  });

  it('does not flag overdue for a charge with no due date set', () => {
    expect(deriveFeeStatus([charge({ amount: 1000, dueDate: null })], [], [], [], TODAY)).toBe('outstanding');
  });

  it('does not flag overdue once the balance is fully paid, even with a past due date', () => {
    expect(
      deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-01-01' })], [payment({ amount: 1000 })], [], [], TODAY),
    ).toBe('paid');
  });

  it('returns outstanding for a learner with no charges at all', () => {
    expect(deriveFeeStatus([], [], [], [], TODAY)).toBe('outstanding');
  });

  it('treats an adjustment as reducing the balance just like a payment would', () => {
    expect(deriveFeeStatus([charge({ amount: 1000 })], [], [adjustment({ amount: 1000 })], [], TODAY)).toBe('paid');
  });

  it('falls back to outstanding (not partially_paid) once a fully-refunded payment leaves no net payment', () => {
    expect(
      deriveFeeStatus(
        [charge({ amount: 1000, dueDate: '2026-12-31' })],
        [payment({ amount: 500 })],
        [],
        [refund({ amount: 500, status: 'completed' })],
        TODAY,
      ),
    ).toBe('outstanding');
  });

  it('a pending refund does not yet reduce net paid, so status stays partially_paid', () => {
    expect(
      deriveFeeStatus(
        [charge({ amount: 1000, dueDate: '2026-12-31' })],
        [payment({ amount: 500 })],
        [],
        [refund({ amount: 500, status: 'pending' })],
        TODAY,
      ),
    ).toBe('partially_paid');
  });
});

describe('buildFeeSummary', () => {
  it('sums charges and payments into totals and a clamped-at-zero outstanding balance', () => {
    const summary = buildFeeSummary(
      [charge({ amount: 1000 }), charge({ id: 'charge-2', amount: 500 })],
      [payment({ amount: 1200 })],
      [],
      [],
      TODAY,
    );
    expect(summary.totalCharged).toBe(1500);
    expect(summary.totalPaid).toBe(1200);
    expect(summary.netPaid).toBe(1200);
    expect(summary.outstandingBalance).toBe(300);
  });

  it('clamps outstandingBalance to zero rather than going negative on a credit balance', () => {
    const summary = buildFeeSummary([charge({ amount: 1000 })], [payment({ amount: 1500 })], [], [], TODAY);
    expect(summary.outstandingBalance).toBe(0);
  });

  it('reports the most recent payment as lastPayment (payments are pre-sorted most-recent-first)', () => {
    const mostRecent = payment({ id: 'payment-recent', paymentDate: '2026-06-01' });
    const older = payment({ id: 'payment-older', paymentDate: '2026-01-01' });
    const summary = buildFeeSummary([charge()], [mostRecent, older], [], [], TODAY);
    expect(summary.lastPayment?.id).toBe('payment-recent');
  });

  it('reports lastPayment as null when no payments have been made', () => {
    const summary = buildFeeSummary([charge()], [], [], [], TODAY);
    expect(summary.lastPayment).toBeNull();
  });

  it('subtracts adjustments from the outstanding balance without affecting totalCharged', () => {
    const summary = buildFeeSummary([charge({ amount: 1000 })], [], [adjustment({ amount: 250 })], [], TODAY);
    expect(summary.totalCharged).toBe(1000);
    expect(summary.totalAdjustments).toBe(250);
    expect(summary.outstandingBalance).toBe(750);
  });

  it('reflects completed refunds in totalRefunded and netPaid, and back into the outstanding balance', () => {
    const summary = buildFeeSummary(
      [charge({ amount: 1000 })],
      [payment({ amount: 1000 })],
      [],
      [refund({ amount: 300, status: 'completed' })],
      TODAY,
    );
    expect(summary.totalPaid).toBe(1000);
    expect(summary.totalRefunded).toBe(300);
    expect(summary.netPaid).toBe(700);
    expect(summary.outstandingBalance).toBe(300);
  });

  it('excludes pending and rejected refunds from totalRefunded', () => {
    const summary = buildFeeSummary(
      [charge({ amount: 1000 })],
      [payment({ amount: 1000 })],
      [],
      [refund({ id: 'r1', amount: 100, status: 'pending' }), refund({ id: 'r2', amount: 50, status: 'rejected' })],
      TODAY,
    );
    expect(summary.totalRefunded).toBe(0);
    expect(summary.netPaid).toBe(1000);
  });

  // FND-FIN-009: charges/payments summed with plain JS `+` can drift off
  // by a cent (the classic 0.1 + 0.2 !== 0.3 problem) once enough
  // cents-denominated rows are added together. buildFeeSummary must be
  // exact — see src/lib/money.ts, which is what actually makes this so.
  it('sums cents-denominated charges/payments exactly, without floating-point drift', () => {
    const summary = buildFeeSummary(
      [charge({ id: 'c1', amount: 100.1 }), charge({ id: 'c2', amount: 100.2 })],
      [payment({ id: 'p1', amount: 50.1 }), payment({ id: 'p2', amount: 50.2 })],
      [],
      [],
      TODAY,
    );
    expect(summary.totalCharged).toBe(200.3);
    expect(summary.totalPaid).toBe(100.3);
    expect(summary.outstandingBalance).toBe(100);
  });
});

describe('calculateCollectionRate', () => {
  it('computes net collected against billed, after adjustments', () => {
    expect(calculateCollectionRate({ totalCharged: 1000, totalAdjustments: 0, netPaid: 750 })).toBe(75);
  });

  it('nets adjustments out of the denominator, matching FinanceOverviewPage', () => {
    // Billed 1000, 100 discounted -> 900 to collect; 900 paid -> 100%.
    expect(calculateCollectionRate({ totalCharged: 1000, totalAdjustments: 100, netPaid: 900 })).toBe(100);
  });

  it('returns null (not 0) when nothing has been billed yet', () => {
    expect(calculateCollectionRate({ totalCharged: 0, totalAdjustments: 0, netPaid: 0 })).toBeNull();
  });

  it('returns null when adjustments fully offset charges (nothing left to collect)', () => {
    expect(calculateCollectionRate({ totalCharged: 500, totalAdjustments: 500, netPaid: 0 })).toBeNull();
  });

  it('rounds to the nearest whole percent', () => {
    expect(calculateCollectionRate({ totalCharged: 3, totalAdjustments: 0, netPaid: 1 })).toBe(33);
  });
});
