import { describe, it, expect } from 'vitest';
import { toCents, fromCents, sumMoney, subtractMoney, addMoney } from '@/lib/money';

describe('money', () => {
  it('toCents converts a Rand amount to integer cents', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0)).toBe(0);
  });

  it('fromCents converts integer cents back to a Rand amount', () => {
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(10)).toBe(0.1);
    expect(fromCents(0)).toBe(0);
  });

  it('sumMoney avoids the classic floating-point drift plain addition produces', () => {
    // The textbook failure: 0.1 + 0.2 !== 0.3 under plain JS number
    // addition. Assert the naive approach actually fails here (otherwise
    // this test would not be proving anything), then assert sumMoney gets
    // the exact right answer.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
  });

  it('sumMoney is exact across many small amounts, unlike a plain reduce', () => {
    const amounts = Array.from({ length: 20 }, () => 0.1);
    const naive = amounts.reduce((sum, a) => sum + a, 0);
    expect(naive).not.toBe(2);
    expect(sumMoney(amounts)).toBe(2);
  });

  it('sumMoney of an empty array is zero', () => {
    expect(sumMoney([])).toBe(0);
  });

  it('subtractMoney is decimal-safe', () => {
    expect(subtractMoney(1000.1, 999.2)).toBe(0.9);
  });

  it('addMoney is decimal-safe', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it('handles realistic multi-charge school-fee totals exactly', () => {
    // 3 termly tuition charges + a transport fee, a common real shape.
    const charges = [4500.0, 4500.0, 4500.0, 1250.5];
    expect(sumMoney(charges)).toBe(14750.5);
  });
});
