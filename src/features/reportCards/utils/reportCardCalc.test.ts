import { describe, it, expect } from 'vitest';
import {
  subjectAveragePercentage,
  overallAveragePercentage,
  resolveBand,
  attendanceRate,
} from './reportCardCalc';
import type { GradingScaleBand } from '@/features/reportCards/types/reportCard.types';

const bands: GradingScaleBand[] = [
  { id: '1', gradingScaleId: 's', schoolId: 'x', code: '7', label: 'Outstanding', descriptor: null, minPercentage: 80, maxPercentage: 100, sortOrder: 0 },
  { id: '2', gradingScaleId: 's', schoolId: 'x', code: '5', label: 'Substantial', descriptor: null, minPercentage: 60, maxPercentage: 79, sortOrder: 1 },
  { id: '3', gradingScaleId: 's', schoolId: 'x', code: '3', label: 'Moderate', descriptor: null, minPercentage: 0, maxPercentage: 59, sortOrder: 2 },
];

describe('subjectAveragePercentage', () => {
  it('weights each mark by its assessment weight', () => {
    // test 40/50 = 80% (w1), exam 60/100 = 60% (w3) -> (80*1 + 60*3)/4 = 65
    expect(subjectAveragePercentage([
      { mark: 40, maxMark: 50, weight: 1 },
      { mark: 60, maxMark: 100, weight: 3 },
    ])).toBe(65);
  });

  it('defaults weight to 1 (plain mean of percentages)', () => {
    expect(subjectAveragePercentage([
      { mark: 9, maxMark: 10 },
      { mark: 6, maxMark: 10 },
    ])).toBe(75);
  });

  it('returns null (never 0) when there are no marks', () => {
    expect(subjectAveragePercentage([])).toBeNull();
  });

  it('ignores marks with a non-positive maxMark rather than dividing by zero', () => {
    expect(subjectAveragePercentage([{ mark: 5, maxMark: 0 }])).toBeNull();
  });

  it('rounds to two decimal places', () => {
    // (1/3)*100 = 33.333...
    expect(subjectAveragePercentage([{ mark: 1, maxMark: 3 }])).toBe(33.33);
  });
});

describe('overallAveragePercentage', () => {
  it('weights subjects and excludes null-average subjects', () => {
    expect(overallAveragePercentage([
      { averagePercentage: 80, weight: 2 },
      { averagePercentage: 50, weight: 1 },
      { averagePercentage: null, weight: 5 },
    ])).toBe(70); // (80*2 + 50*1) / 3
  });

  it('returns null when every subject average is null', () => {
    expect(overallAveragePercentage([{ averagePercentage: null }, { averagePercentage: null }])).toBeNull();
  });
});

describe('resolveBand', () => {
  it('maps a percentage to its band on the rounded value', () => {
    expect(resolveBand(bands, 79.6)?.code).toBe('7'); // rounds to 80
    expect(resolveBand(bands, 60)?.code).toBe('5'); // inclusive lower bound
    expect(resolveBand(bands, 0)?.code).toBe('3');
  });

  it('returns null when nothing matches or percentage is null', () => {
    expect(resolveBand([], 50)).toBeNull();
    expect(resolveBand(bands, null)).toBeNull();
  });
});

describe('attendanceRate', () => {
  it('counts present + late as attended, excludes excused from the denominator', () => {
    expect(attendanceRate(8, 1, 1)).toBe(90); // (8+1)/(8+1+1)
  });
  it('returns null with no qualifying days', () => {
    expect(attendanceRate(0, 0, 0)).toBeNull();
  });
});
