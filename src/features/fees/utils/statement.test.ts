import { describe, it, expect } from 'vitest';
import { buildAccountStatement } from '@/features/fees/utils/statement';
import type {
  LearnerFeeCharge,
  LearnerFeePayment,
  LearnerFeeAdjustment,
  LearnerFeeRefund,
} from '@/features/fees/types/fee.types';

function charge(over: Partial<LearnerFeeCharge>): LearnerFeeCharge {
  return {
    id: crypto.randomUUID(),
    schoolId: 's',
    learnerId: 'l',
    academicYearId: 'y',
    feeStructureId: null,
    invoiceId: null,
    description: 'Tuition',
    category: 'tuition',
    amount: 1000,
    dueDate: '2026-02-01',
    notes: null,
    active: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...over,
  } as LearnerFeeCharge;
}

function payment(over: Partial<LearnerFeePayment>): LearnerFeePayment {
  return {
    id: crypto.randomUUID(),
    schoolId: 's',
    learnerId: 'l',
    academicYearId: 'y',
    amount: 400,
    paymentDate: '2026-02-10',
    method: 'eft',
    reference: 'REF',
    notes: null,
    active: true,
    reconciledAt: null,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
    ...over,
  } as LearnerFeePayment;
}

function adjustment(over: Partial<LearnerFeeAdjustment>): LearnerFeeAdjustment {
  return {
    id: crypto.randomUUID(),
    schoolId: 's',
    learnerId: 'l',
    academicYearId: 'y',
    chargeId: null,
    adjustmentType: 'bursary',
    method: 'fixed_amount',
    percentage: null,
    amount: 100,
    reason: 'Sibling discount',
    active: true,
    createdAt: '2026-02-05T00:00:00Z',
    updatedAt: '2026-02-05T00:00:00Z',
    ...over,
  } as LearnerFeeAdjustment;
}

function refund(over: Partial<LearnerFeeRefund>): LearnerFeeRefund {
  return {
    id: crypto.randomUUID(),
    schoolId: 's',
    learnerId: 'l',
    academicYearId: 'y',
    paymentId: 'p',
    amount: 50,
    refundDate: '2026-03-01',
    method: 'eft',
    reference: null,
    reason: 'Overpayment',
    status: 'completed',
    active: true,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...over,
  } as LearnerFeeRefund;
}

describe('buildAccountStatement', () => {
  it('produces a running balance in chronological order', () => {
    const statement = buildAccountStatement({
      charges: [charge({ amount: 1000, dueDate: '2026-02-01' })],
      payments: [payment({ amount: 400, paymentDate: '2026-02-10' })],
      adjustments: [adjustment({ amount: 100, createdAt: '2026-02-05T00:00:00Z' })],
      refunds: [],
      asOf: '2026-03-31',
    });

    expect(statement.entries.map((e) => e.runningBalance)).toEqual([1000, 900, 500]);
    expect(statement.closingBalance).toBe(500);
  });

  it('treats a completed refund as re-opening the balance', () => {
    const statement = buildAccountStatement({
      charges: [charge({ amount: 1000 })],
      payments: [payment({ amount: 1000, paymentDate: '2026-02-10' })],
      adjustments: [],
      refunds: [refund({ amount: 200, refundDate: '2026-03-01', status: 'completed' })],
      asOf: '2026-03-31',
    });
    expect(statement.closingBalance).toBe(200);
  });

  it('ignores a pending refund', () => {
    const statement = buildAccountStatement({
      charges: [charge({ amount: 1000 })],
      payments: [payment({ amount: 1000, paymentDate: '2026-02-10' })],
      adjustments: [],
      refunds: [refund({ amount: 200, status: 'pending' })],
      asOf: '2026-03-31',
    });
    expect(statement.closingBalance).toBe(0);
    expect(statement.entries.some((e) => e.type === 'refund')).toBe(false);
  });

  it('excludes entries dated after asOf', () => {
    const statement = buildAccountStatement({
      charges: [charge({ amount: 1000, dueDate: '2026-02-01' }), charge({ amount: 500, dueDate: '2026-06-01' })],
      payments: [],
      adjustments: [],
      refunds: [],
      asOf: '2026-03-01',
    });
    expect(statement.entries).toHaveLength(1);
    expect(statement.closingBalance).toBe(1000);
  });

  it('ages an unpaid overdue charge into the right bucket', () => {
    // charge due 2026-01-01, statement as at 2026-04-15 -> ~104 days overdue -> 90+ bucket.
    const statement = buildAccountStatement({
      charges: [charge({ amount: 1000, dueDate: '2026-01-01' })],
      payments: [],
      adjustments: [],
      refunds: [],
      asOf: '2026-04-15',
    });
    expect(statement.ageing.days90).toBe(1000);
    expect(statement.ageing.current).toBe(0);
  });

  it('applies payments FIFO to the oldest charges for ageing', () => {
    const statement = buildAccountStatement({
      charges: [
        charge({ amount: 1000, dueDate: '2026-01-01' }),
        charge({ amount: 1000, dueDate: '2026-04-01' }),
      ],
      payments: [payment({ amount: 1000, paymentDate: '2026-04-20' })],
      adjustments: [],
      refunds: [],
      asOf: '2026-04-20',
    });
    // Oldest charge settled; only the 2026-04-01 charge (19 days overdue) remains -> current.
    expect(statement.closingBalance).toBe(1000);
    expect(statement.ageing.current).toBe(1000);
    expect(statement.ageing.days90).toBe(0);
  });
});
