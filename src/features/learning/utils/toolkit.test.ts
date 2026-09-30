import { describe, expect, it } from 'vitest';
import {
  accessBadges,
  altTextOf,
  formatMinutes,
  groupByStage,
  isLowResource,
  parseBlocks,
  parseScore,
  summariseProgress,
  TOOLKIT_STAGES,
} from '@/features/learning/utils/toolkit';

const base = {
  connectivity: 'none',
  device: 'teacher_device',
  projector_required: false,
  printable: false,
  size_kb: null,
} as const;

describe('isLowResource', () => {
  it('accepts a resource that needs no projector, no connectivity and no learner device', () => {
    expect(isLowResource(base)).toBe(true);
    expect(isLowResource({ ...base, device: 'none' })).toBe(true);
  });

  it('rejects anything that needs a projector, data or learner/shared devices', () => {
    expect(isLowResource({ ...base, projector_required: true })).toBe(false);
    expect(isLowResource({ ...base, connectivity: 'low' })).toBe(false);
    expect(isLowResource({ ...base, device: 'learner_device' })).toBe(false);
    expect(isLowResource({ ...base, device: 'shared_device' })).toBe(false);
  });
});

describe('accessBadges', () => {
  it('says plainly that a resource works offline with no projector', () => {
    const labels = accessBadges(base).map((b) => b.label);
    expect(labels).toContain('Works offline');
    expect(labels).toContain('No projector needed');
    expect(labels).toContain('Teacher device');
  });

  it('warns when data, a projector or learner devices are needed, and flags printables', () => {
    const badges = accessBadges({
      ...base,
      connectivity: 'online',
      projector_required: true,
      device: 'learner_device',
      printable: true,
    });
    expect(badges.find((b) => b.label === 'Needs internet')?.tone).toBe('warn');
    expect(badges.find((b) => b.label === 'Needs a projector')?.tone).toBe('warn');
    expect(badges.find((b) => b.label === 'Learner devices')?.tone).toBe('warn');
    expect(badges.map((b) => b.label)).toContain('Printable');
  });
});

describe('groupByStage', () => {
  it('returns every stage, in teaching order, and sorts easiest first', () => {
    const grouped = groupByStage([
      { stage: 'practise', difficulty: 'advanced', title: 'B' },
      { stage: 'practise', difficulty: 'foundational', title: 'Z' },
      { stage: 'practise', difficulty: 'foundational', title: 'A' },
      { stage: 'explain', difficulty: 'standard', title: 'E' },
    ] as never);
    expect(Object.keys(grouped)).toEqual(TOOLKIT_STAGES.map((s) => s.key));
    expect(grouped.practise.map((r) => r.title)).toEqual(['A', 'Z', 'B']);
    expect(grouped.challenge).toEqual([]);
  });
});

describe('summariseProgress', () => {
  it('counts statuses and surfaces who needs support and who is ready', () => {
    const summary = summariseProgress([
      { status: 'mastered' },
      { status: 'needs_support' },
      { status: 'needs_support' },
      { status: 'not_started' },
      { status: 'completed' },
    ]);
    expect(summary.total).toBe(5);
    expect(summary.needingSupport).toBe(2);
    expect(summary.ready).toBe(1);
    expect(summary.counts.completed).toBe(1);
  });
});

describe('parseBlocks', () => {
  it('parses known block types', () => {
    const blocks = parseBlocks({
      blocks: [
        { type: 'heading', text: 'Say it' },
        { type: 'steps', items: ['one', 'two'] },
        { type: 'table', headers: ['Th', 'H'], rows: [['4', '3']] },
      ],
    });
    expect(blocks).toHaveLength(3);
    expect(blocks[2]).toEqual({ type: 'table', headers: ['Th', 'H'], rows: [['4', '3']] });
  });

  it('drops unknown, empty and malformed blocks instead of rendering them', () => {
    expect(
      parseBlocks({
        blocks: [
          { type: 'script', text: '<script>alert(1)</script>' },
          { type: 'paragraph', text: '  ' },
          'x',
          null,
        ],
      }),
    ).toEqual([]);
    expect(parseBlocks({ blocks: 'nope' })).toEqual([]);
    expect(parseBlocks(null as never)).toEqual([]);
    expect(parseBlocks({ blocks: [{ type: 'steps', items: [1, 2] }] })).toEqual([]);
  });
});

describe('altTextOf / formatMinutes', () => {
  it('returns alt text only when present', () => {
    expect(altTextOf({ alt_text: 'A chart' })).toBe('A chart');
    expect(altTextOf({ alt_text: ' ' })).toBeNull();
    expect(altTextOf({})).toBeNull();
  });

  it('formats minutes', () => {
    expect(formatMinutes(15)).toBe('15 min');
    expect(formatMinutes(1)).toBe('1 min');
    expect(formatMinutes(null)).toBeNull();
  });
});

describe('parseScore', () => {
  it('treats blank as "not entered" and accepts comma decimals', () => {
    expect(parseScore('', 6)).toBeNull();
    expect(parseScore('  ', 6)).toBeNull();
    expect(parseScore('4,5', 6)).toBe(4.5);
    expect(parseScore('0', 6)).toBe(0);
    expect(parseScore('6', 6)).toBe(6);
  });

  it('rejects scores outside 0 to the maximum, and non-numbers', () => {
    expect(Number.isNaN(parseScore('7', 6))).toBe(true);
    expect(Number.isNaN(parseScore('-1', 6))).toBe(true);
    expect(Number.isNaN(parseScore('abc', 6))).toBe(true);
  });
});
