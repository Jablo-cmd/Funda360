import { describe, it, expect } from 'vitest';
import { toPercentage, calculateMarkStats, isValidMark } from '@/features/assessments/utils/calculations';

describe('toPercentage', () => {
  it('calculates an exact percentage', () => {
    expect(toPercentage(42, 50)).toBe(84);
  });

  it('calculates another exact percentage', () => {
    expect(toPercentage(37, 50)).toBe(74);
  });

  it('rounds a non-exact percentage to the nearest whole number', () => {
    expect(toPercentage(41, 60)).toBe(68); // 68.333...
  });

  it('rounds up when the fraction is at or above .5', () => {
    expect(toPercentage(2, 3)).toBe(67); // 66.666...
  });

  it('returns 0 for a zero max mark rather than dividing by zero', () => {
    expect(toPercentage(0, 0)).toBe(0);
  });

  it('returns 100 for a full mark', () => {
    expect(toPercentage(50, 50)).toBe(100);
  });

  it('returns 0 for a zero mark', () => {
    expect(toPercentage(0, 50)).toBe(0);
  });
});

describe('calculateMarkStats', () => {
  it('excludes unmarked learners from the average — no mark never becomes a 0', () => {
    // 41 learners, only 2 marked (42 and 37 out of 50) — matches the sprint brief's own worked example shape.
    const stats = calculateMarkStats([42, 37], 50, 41);
    expect(stats.markedCount).toBe(2);
    expect(stats.unmarkedCount).toBe(39);
    expect(stats.totalCount).toBe(41);
    // (42 + 37) / 2 = 39.5 -> 79%, not diluted by the 39 unmarked learners.
    expect(stats.averageMark).toBe(39.5);
    expect(stats.averagePercentage).toBe(79);
  });

  it('reports null statistics when nobody has been marked yet, not zero', () => {
    const stats = calculateMarkStats([], 50, 30);
    expect(stats.markedCount).toBe(0);
    expect(stats.unmarkedCount).toBe(30);
    expect(stats.averageMark).toBeNull();
    expect(stats.averagePercentage).toBeNull();
    expect(stats.highestMark).toBeNull();
    expect(stats.lowestMark).toBeNull();
  });

  it('rounds the average to one decimal place', () => {
    // (42 + 37 + 45) / 3 = 41.333...
    const stats = calculateMarkStats([42, 37, 45], 50, 3);
    expect(stats.averageMark).toBe(41.3);
  });

  it('finds the highest and lowest mark', () => {
    const stats = calculateMarkStats([42, 37, 45, 21], 50, 4);
    expect(stats.highestMark).toBe(45);
    expect(stats.lowestMark).toBe(21);
  });

  it('treats a fully marked class correctly (zero unmarked)', () => {
    const stats = calculateMarkStats([50, 50], 50, 2);
    expect(stats.unmarkedCount).toBe(0);
    expect(stats.averagePercentage).toBe(100);
  });

  it('never reports a negative unmarked count if given an inconsistent total', () => {
    const stats = calculateMarkStats([42, 37, 45], 50, 1);
    expect(stats.unmarkedCount).toBe(0);
  });
});

describe('isValidMark', () => {
  it('accepts a mark within range', () => {
    expect(isValidMark(42, 50)).toBe(true);
  });

  it('accepts a mark of exactly zero', () => {
    expect(isValidMark(0, 50)).toBe(true);
  });

  it('accepts a mark equal to the maximum', () => {
    expect(isValidMark(50, 50)).toBe(true);
  });

  it('rejects a negative mark', () => {
    expect(isValidMark(-1, 50)).toBe(false);
  });

  it('rejects a mark above the maximum', () => {
    expect(isValidMark(51, 50)).toBe(false);
  });

  it('rejects a non-integer mark', () => {
    expect(isValidMark(41.5, 50)).toBe(false);
  });
});
