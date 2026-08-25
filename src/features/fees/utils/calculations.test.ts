import { describe, expect, it } from 'vitest';
import { deriveFeeStatus, buildFeeSummary } from './calculations';
import type { LearnerFeeCharge, LearnerFeePayment } from '@/features/fees/types/fee.types';

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
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveFeeStatus', () => {
  it('returns outstanding when charges exist and nothing has been paid', () => {
    expect(deriveFeeStatus([charge()], [], TODAY)).toBe('outstanding');
  });

  it('returns paid when payments cover the full charged amount', () => {
    expect(deriveFeeStatus([charge({ amount: 1000 })], [payment({ amount: 1000 })], TODAY)).toBe('paid');
  });

  it('returns paid when payments exceed the charged amount (credit balance)', () => {
    expect(deriveFeeStatus([charge({ amount: 1000 })], [payment({ amount: 1200 })], TODAY)).toBe('paid');
  });

  it('returns partially_paid when some but not all of the balance has been paid, and no charge is overdue', () => {
    expect(
      deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-12-31' })], [payment({ amount: 400 })], TODAY),
    ).toBe('partially_paid');
  });

  it('returns overdue when a balance remains and a charge is past its due date', () => {
    expect(deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-01-01' })], [], TODAY)).toBe('overdue');
  });

  it('prioritizes overdue over partially_paid when both conditions hold', () => {
    expect(
      deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-01-01' })], [payment({ amount: 400 })], TODAY),
    ).toBe('overdue');
  });

  it('does not flag overdue for a charge with no due date set', () => {
    expect(deriveFeeStatus([charge({ amount: 1000, dueDate: null })], [], TODAY)).toBe('outstanding');
  });

  it('does not flag overdue once the balance is fully paid, even with a past due date', () => {
    expect(
      deriveFeeStatus([charge({ amount: 1000, dueDate: '2026-01-01' })], [payment({ amount: 1000 })], TODAY),
    ).toBe('paid');
  });

  it('returns outstanding for a learner with no charges at all', () => {
    expect(deriveFeeStatus([], [], TODAY)).toBe('outstanding');
  });
});

describe('buildFeeSummary', () => {
  it('sums charges and payments into totals and a clamped-at-zero outstanding balance', () => {
    const summary = buildFeeSummary(
      [charge({ amount: 1000 }), charge({ id: 'charge-2', amount: 500 })],
      [payment({ amount: 1200 })],
      TODAY,
    );
    expect(summary.totalCharged).toBe(1500);
    expect(summary.totalPaid).toBe(1200);
    expect(summary.outstandingBalance).toBe(300);
  });

  it('clamps outstandingBalance to zero rather than going negative on a credit balance', () => {
    const summary = buildFeeSummary([charge({ amount: 1000 })], [payment({ amount: 1500 })], TODAY);
    expect(summary.outstandingBalance).toBe(0);
  });

  it('reports the most recent payment as lastPayment (payments are pre-sorted most-recent-first)', () => {
    const mostRecent = payment({ id: 'payment-recent', paymentDate: '2026-06-01' });
    const older = payment({ id: 'payment-older', paymentDate: '2026-01-01' });
    const summary = buildFeeSummary([charge()], [mostRecent, older], TODAY);
    expect(summary.lastPayment?.id).toBe('payment-recent');
  });

  it('reports lastPayment as null when no payments have been made', () => {
    const summary = buildFeeSummary([charge()], [], TODAY);
    expect(summary.lastPayment).toBeNull();
  });
});
