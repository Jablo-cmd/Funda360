import { describe, expect, it } from 'vitest';
import type { CurriculumSourceRow } from '@/lib/database.types';
import {
  LADDER_STEPS,
  POSITIVE_DECISION,
  citableSources,
  countLine,
  decisionProblems,
  itemState,
  itemStateLabel,
  looksLikeRecordLine,
  parseAlternateUrls,
  questionProblems,
  type ReviewCurrent,
} from '@/features/content-studio/utils/review';

const current = (over: Partial<ReviewCurrent> = {}): ReviewCurrent => ({
  decision: 'accepted',
  stale: false,
  reviewer: 'r',
  reviewed_at: '2026-10-03T00:00:00Z',
  notes: 'n',
  source_id: null,
  source_section: null,
  source_page: null,
  ...over,
});

describe('the verification ladder', () => {
  it('has five separate steps with the agreed meanings', () => {
    expect(LADDER_STEPS.map((s) => s.label)).toEqual([
      'Indexed',
      'Retrieved',
      'Identity verified',
      'Content reviewed',
      'Curriculum verified',
    ]);
    expect(LADDER_STEPS[0]?.meaning).toBe('A DBE source was identified at the recorded location.');
    expect(LADDER_STEPS[1]?.meaning).toBe('The actual document bytes were downloaded and hashed.');
    expect(LADDER_STEPS[2]?.meaning).toBe(
      'A human confirmed that the retrieved document is the intended authoritative edition.',
    );
    expect(LADDER_STEPS[3]?.meaning).toBe('A human reviewed the actual document.');
    expect(LADDER_STEPS[4]?.meaning).toBe('A specific Funda360 curriculum unit was checked against the source.');
  });
});

describe('decisionProblems', () => {
  const base = { notes: 'checked', sourceId: '', section: '', page: '' };
  it('needs notes for every decision', () => {
    expect(decisionProblems({ ...base, entity: 'lesson', decision: 'accepted', notes: '' })).toContain('Write your reviewer notes.');
    expect(decisionProblems({ ...base, entity: 'lesson', decision: 'rejected', notes: ' ' })).toContain('Write your reviewer notes.');
  });
  it('lets a lesson be accepted with notes alone', () => {
    expect(decisionProblems({ ...base, entity: 'lesson', decision: 'accepted' })).toEqual([]);
  });
  it('will not verify an objective without a source, section and page', () => {
    const p = decisionProblems({ ...base, entity: 'objective', decision: 'verified' });
    expect(p).toHaveLength(3);
    expect(p.join(' ')).toMatch(/source/);
    expect(p.join(' ')).toMatch(/section/);
    expect(p.join(' ')).toMatch(/page/);
  });
  it('will verify an objective once all three are given', () => {
    expect(decisionProblems({ ...base, entity: 'objective', decision: 'verified', sourceId: 's', section: '3.3.1', page: '35' })).toEqual([]);
  });
  it('does not ask for a source when requesting a correction or rejecting', () => {
    expect(decisionProblems({ ...base, entity: 'objective', decision: 'needs_correction' })).toEqual([]);
    expect(decisionProblems({ ...base, entity: 'objective', decision: 'rejected' })).toEqual([]);
  });
  it('treats the formal assessment like an objective', () => {
    expect(decisionProblems({ ...base, entity: 'formal_assessment', decision: 'verified' })).toHaveLength(3);
  });
  it('uses verified for objectives and accepted for content', () => {
    expect(POSITIVE_DECISION.objective).toBe('verified');
    expect(POSITIVE_DECISION.question).toBe('accepted');
    expect(POSITIVE_DECISION.formal_assessment).toBe('verified');
  });
});

describe('questionProblems', () => {
  const base = { answer: '', sourceId: '', section: '', page: '', notes: '' };
  it('resolving needs the answer, a source, section, page and an explanation', () => {
    expect(questionProblems({ ...base, status: 'resolved' })).toHaveLength(5);
    expect(questionProblems({ status: 'resolved', answer: 'No division', sourceId: 's', section: '3.3.1', page: '35', notes: 'read it' })).toEqual([]);
  });
  it('deferring needs only a reason, and says so', () => {
    expect(questionProblems({ ...base, status: 'deferred' })).toEqual(['Say why it is deferred.']);
    expect(questionProblems({ ...base, status: 'deferred', notes: 'ATP not readable' })).toEqual([]);
  });
});

describe('itemState', () => {
  it('is pending with no decision', () => {
    expect(itemState(null)).toBe('pending');
    expect(itemStateLabel('pending')).toBe('Pending');
  });
  it('counts a decision on changed content as stale, which reads as pending again', () => {
    expect(itemState(current({ stale: true }))).toBe('stale');
    expect(itemStateLabel('stale')).toMatch(/pending/);
  });
  it('reports the decision otherwise', () => {
    expect(itemState(current({ decision: 'needs_correction' }))).toBe('needs_correction');
    expect(itemStateLabel('rejected')).toBe('Rejected');
  });
});

describe('citableSources', () => {
  it('only offers sources whose identity is verified', () => {
    const mk = (status: CurriculumSourceRow['status']) => ({ id: status, status }) as CurriculumSourceRow;
    expect(citableSources([mk('registered'), mk('verified'), mk('retired')]).map((s) => s.id)).toEqual(['verified']);
  });
});

describe('helpers', () => {
  it('recognises a RECORD line from the verification script', () => {
    const line = ['RECORD', '1', 'retrieved', '200', '0', '10', 'a'.repeat(64), 'application/pdf', 'https://x/y', 'https://x/y'].join('\t');
    expect(looksLikeRecordLine(line)).toBe(true);
    expect(looksLikeRecordLine('a'.repeat(64))).toBe(false);
    expect(looksLikeRecordLine('RECORD\t1')).toBe(false);
  });
  it('flags alternate addresses that are not https', () => {
    expect(parseAlternateUrls('https://a.example\nhttp://b.example')).toEqual({
      urls: ['https://a.example', 'http://b.example'],
      bad: ['http://b.example'],
    });
  });
  it('writes a count line without inventing anything', () => {
    expect(countLine({ total: 27, positive: 0, needs_correction: 0, rejected: 0, pending: 27 }, 'verified')).toBe('27 total · 0 verified · 27 pending');
    expect(countLine({ total: 5, positive: 1, needs_correction: 2, rejected: 1, pending: 1 }, 'accepted')).toBe(
      '5 total · 1 accepted · 1 pending · 2 need correction · 1 rejected',
    );
  });
});
