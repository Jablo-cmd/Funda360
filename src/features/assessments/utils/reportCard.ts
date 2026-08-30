import { toPercentage } from '@/features/assessments/utils/calculations';
import type { LearnerAssessmentResult } from '@/features/assessments/types/assessment.types';

export interface ReportCardSubjectRow {
  subjectId: string;
  subjectName: string;
  results: LearnerAssessmentResult[];
  averagePercentage: number;
}

export interface ReportCardData {
  subjects: ReportCardSubjectRow[];
  overallAveragePercentage: number | null;
}

/**
 * Groups a learner's already-fetched results by subject and computes a
 * simple mean-of-percentages average per subject and overall — deliberately
 * unweighted (no per-assessment weighting column exists anywhere in this
 * schema, see the assessments migration's own "no weighting column"
 * decision) rather than inventing a weighting scheme this domain has never
 * had. `subjectNamesById` and an optional term/year filter are supplied by
 * the caller (the same lookups LearnerAssessmentResultsSection already
 * has) rather than re-fetched here.
 */
export function buildReportCardData(
  results: LearnerAssessmentResult[],
  subjectNamesById: Record<string, string>,
  filter?: { termId?: string; academicYearId?: string },
): ReportCardData {
  const filtered = results.filter(
    (r) => (!filter?.termId || r.termId === filter.termId) && (!filter?.academicYearId || r.academicYearId === filter.academicYearId),
  );

  const bySubject = new Map<string, LearnerAssessmentResult[]>();
  for (const result of filtered) {
    const group = bySubject.get(result.subjectId) ?? [];
    group.push(result);
    bySubject.set(result.subjectId, group);
  }

  const subjects: ReportCardSubjectRow[] = [...bySubject.entries()]
    .map(([subjectId, subjectResults]) => {
      const percentages = subjectResults.map((r) => toPercentage(r.mark, r.maxMark));
      const averagePercentage = Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length);
      return { subjectId, subjectName: subjectNamesById[subjectId] ?? 'Unknown subject', results: subjectResults, averagePercentage };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const overallAveragePercentage =
    subjects.length === 0 ? null : Math.round(subjects.reduce((sum, s) => sum + s.averagePercentage, 0) / subjects.length);

  return { subjects, overallAveragePercentage };
}
