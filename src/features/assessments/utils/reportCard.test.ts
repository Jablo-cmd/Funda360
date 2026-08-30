import { describe, expect, it } from 'vitest';
import { buildReportCardData } from './reportCard';
import type { LearnerAssessmentResult } from '@/features/assessments/types/assessment.types';

function result(overrides: Partial<LearnerAssessmentResult> = {}): LearnerAssessmentResult {
  return {
    resultId: 'result-1',
    assessmentId: 'assessment-1',
    title: 'Test 1',
    assessmentType: 'test',
    assessmentDate: '2026-02-01',
    mark: 80,
    maxMark: 100,
    subjectId: 'subject-math',
    termId: 'term-1',
    academicYearId: 'year-2026',
    ...overrides,
  };
}

const SUBJECT_NAMES = { 'subject-math': 'Mathematics', 'subject-eng': 'English Home Language' };

describe('buildReportCardData', () => {
  it('groups results by subject and computes a per-subject average percentage', () => {
    const data = buildReportCardData(
      [result({ mark: 80, maxMark: 100 }), result({ resultId: 'r2', mark: 60, maxMark: 100 })],
      SUBJECT_NAMES,
    );
    expect(data.subjects).toHaveLength(1);
    expect(data.subjects[0]).toMatchObject({ subjectId: 'subject-math', subjectName: 'Mathematics', averagePercentage: 70 });
  });

  it('computes the overall average as the mean of subject averages, not a flat mean of every mark', () => {
    // Maths: 2 results averaging 70%. English: 1 result at 100%. A flat
    // mean of the 3 raw marks would differ from the mean-of-subject-averages
    // this function deliberately uses — 3 subjects contribute equally.
    const data = buildReportCardData(
      [
        result({ subjectId: 'subject-math', mark: 80, maxMark: 100 }),
        result({ resultId: 'r2', subjectId: 'subject-math', mark: 60, maxMark: 100 }),
        result({ resultId: 'r3', subjectId: 'subject-eng', mark: 100, maxMark: 100 }),
      ],
      SUBJECT_NAMES,
    );
    expect(data.subjects.find((s) => s.subjectId === 'subject-math')?.averagePercentage).toBe(70);
    expect(data.subjects.find((s) => s.subjectId === 'subject-eng')?.averagePercentage).toBe(100);
    expect(data.overallAveragePercentage).toBe(85); // (70 + 100) / 2
  });

  it('sorts subjects alphabetically by name', () => {
    const data = buildReportCardData(
      [result({ subjectId: 'subject-eng' }), result({ resultId: 'r2', subjectId: 'subject-math' })],
      SUBJECT_NAMES,
    );
    expect(data.subjects.map((s) => s.subjectName)).toEqual(['English Home Language', 'Mathematics']);
  });

  it('filters to a single term when termId is supplied', () => {
    const data = buildReportCardData(
      [result({ termId: 'term-1' }), result({ resultId: 'r2', termId: 'term-2', mark: 40 })],
      SUBJECT_NAMES,
      { termId: 'term-1' },
    );
    expect(data.subjects[0]!.results).toHaveLength(1);
    expect(data.subjects[0]!.results[0]!.termId).toBe('term-1');
  });

  it('filters to a single academic year when academicYearId is supplied', () => {
    const data = buildReportCardData(
      [result({ academicYearId: 'year-2026' }), result({ resultId: 'r2', academicYearId: 'year-2025' })],
      SUBJECT_NAMES,
      { academicYearId: 'year-2026' },
    );
    expect(data.subjects[0]!.results).toHaveLength(1);
  });

  it('returns an empty subjects list and a null overall average when there are no results', () => {
    const data = buildReportCardData([], SUBJECT_NAMES);
    expect(data.subjects).toEqual([]);
    expect(data.overallAveragePercentage).toBeNull();
  });

  it('falls back to a placeholder name for a subject id missing from the lookup, rather than throwing', () => {
    const data = buildReportCardData([result({ subjectId: 'unknown-subject' })], SUBJECT_NAMES);
    expect(data.subjects[0]!.subjectName).toBe('Unknown subject');
  });
});
