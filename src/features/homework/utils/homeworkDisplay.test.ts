import { describe, expect, it } from 'vitest';
import { isMissing, summariseSubmissions, formatDue } from './homeworkDisplay';

const NOW = new Date('2026-09-10T12:00:00.000Z');
const past = '2026-09-08T12:00:00.000Z';
const future = '2026-09-20T12:00:00.000Z';

describe('isMissing', () => {
  it('is true for an unsubmitted assignment past its due date', () => {
    expect(isMissing({ status: 'assigned' }, past, NOW)).toBe(true);
  });
  it('is false before the due date', () => {
    expect(isMissing({ status: 'assigned' }, future, NOW)).toBe(false);
  });
  it('is false once submitted, even if late', () => {
    expect(isMissing({ status: 'late' }, past, NOW)).toBe(false);
  });
  it('is false when there is no due date', () => {
    expect(isMissing({ status: 'assigned' }, null, NOW)).toBe(false);
  });
});

describe('summariseSubmissions', () => {
  it('rolls up the class state', () => {
    const summary = summariseSubmissions(
      [
        { status: 'assigned' }, // missing (past due)
        { status: 'assigned' },
        { status: 'submitted' }, // awaiting marking
        { status: 'late' }, // awaiting marking
        { status: 'returned' }, // submitted, not awaiting
        { status: 'reviewed' }, // marked
        { status: 'excused' }, // marked
      ],
      past,
      NOW,
    );
    expect(summary).toEqual({ total: 7, submitted: 3, awaiting: 2, missing: 2, marked: 2 });
  });

  it('counts nothing as missing before the due date', () => {
    const summary = summariseSubmissions([{ status: 'assigned' }, { status: 'assigned' }], future, NOW);
    expect(summary.missing).toBe(0);
  });
});

describe('formatDue', () => {
  it('handles a null due date', () => {
    expect(formatDue(null)).toBe('No due date');
  });
  it('renders a due date', () => {
    expect(formatDue(future)).toMatch(/^Due /);
  });
});
