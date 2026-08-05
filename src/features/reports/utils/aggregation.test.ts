import { describe, it, expect } from 'vitest';
import { countBy, countActiveVsTotal } from '@/features/reports/utils/aggregation';

describe('countBy', () => {
  it('counts items grouped by the given key', () => {
    const items = [{ status: 'active' }, { status: 'active' }, { status: 'inactive' }];
    expect(countBy(items, (item) => item.status)).toEqual({ active: 2, inactive: 1 });
  });

  it('returns an empty object for an empty list', () => {
    expect(countBy([], (item: { status: string }) => item.status)).toEqual({});
  });

  it('handles a single group', () => {
    const items = [{ status: 'active' }, { status: 'active' }];
    expect(countBy(items, (item) => item.status)).toEqual({ active: 2 });
  });
});

describe('countActiveVsTotal', () => {
  it('splits items into active and archived counts', () => {
    const items = [{ active: true }, { active: true }, { active: false }];
    expect(countActiveVsTotal(items, (item) => item.active)).toEqual({ active: 2, archived: 1, total: 3 });
  });

  it('returns all zeros for an empty list', () => {
    expect(countActiveVsTotal([], (item: { active: boolean }) => item.active)).toEqual({
      active: 0,
      archived: 0,
      total: 0,
    });
  });

  it('handles a list with no active items', () => {
    const items = [{ active: false }, { active: false }];
    expect(countActiveVsTotal(items, (item) => item.active)).toEqual({ active: 0, archived: 2, total: 2 });
  });
});
