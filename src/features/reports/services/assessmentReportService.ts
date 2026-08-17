import { supabase } from '@/lib/supabase';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import { calculateMarkStats, toPercentage } from '@/features/assessments/utils/calculations';
import type { AssessmentResultReportRow, AssessmentClassPerformanceRow } from '@/features/reports/types/report.types';
import type { Class, Subject, Term, AcademicYear } from '@/features/academic/types/academic.types';

export interface AssessmentReportFilters {
  classId?: string;
  subjectId?: string;
  termId?: string;
  academicYearId?: string;
}

export interface AssessmentReportContext {
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  termsById: Record<string, Term>;
  academicYearsById: Record<string, AcademicYear>;
}

export interface AssessmentReport {
  resultRows: AssessmentResultReportRow[];
  classPerformanceRows: AssessmentClassPerformanceRow[];
}

/**
 * Assembles both report views the sprint brief asks for (per-result detail,
 * and per-assessment class performance) from one shared fetch — the
 * assessments matching the given filters, and every result recorded
 * against them, batched (not one request per assessment). Name resolution
 * for class/subject/term/academic year reuses whatever the caller already
 * has loaded via the existing academic hooks (context, matching every
 * other report/list page's convention) rather than re-fetching; only
 * learner names are fetched here, since no report page already loads them.
 */
async function getAssessmentReport(schoolId: string, filters: AssessmentReportFilters, context: AssessmentReportContext): Promise<AssessmentReport> {
  const assessments = await assessmentService.getAssessments(schoolId, filters);
  if (assessments.length === 0) return { resultRows: [], classPerformanceRows: [] };

  const results = await assessmentService.getResultsForAssessments(assessments.map((a) => a.id));

  const learnerIds = [...new Set(results.map((r) => r.learnerId))];
  const learnersById = new Map<string, string>();
  if (learnerIds.length > 0) {
    const { data, error } = await supabase.from('learners').select('id, first_name, last_name').in('id', learnerIds);
    if (error) throw error;
    for (const row of data) learnersById.set(row.id, `${row.first_name} ${row.last_name}`);
  }

  const assessmentsById = new Map(assessments.map((a) => [a.id, a]));

  const resultRows: AssessmentResultReportRow[] = results.map((result) => {
    const assessment = assessmentsById.get(result.assessmentId);
    const classId = assessment?.classId ?? '';
    const subjectId = assessment?.subjectId ?? '';
    const termId = assessment?.termId ?? '';
    const academicYearId = assessment?.academicYearId ?? '';
    const maxMark = assessment?.maxMark ?? 0;
    return {
      learnerId: result.learnerId,
      learnerName: learnersById.get(result.learnerId) ?? 'Unknown learner',
      classId,
      className: context.classesById[classId]?.name ?? '—',
      subjectId,
      subjectName: context.subjectsById[subjectId]?.name ?? '—',
      assessmentId: result.assessmentId,
      assessmentTitle: assessment?.title ?? '—',
      mark: result.mark,
      maxMark,
      percentage: toPercentage(result.mark, maxMark),
      termId,
      termName: context.termsById[termId]?.name ?? '—',
      academicYearId,
      academicYearName: context.academicYearsById[academicYearId]?.name ?? '—',
    };
  });

  const classPerformanceRows: AssessmentClassPerformanceRow[] = assessments.map((assessment) => {
    const marks = results.filter((r) => r.assessmentId === assessment.id).map((r) => r.mark);
    // totalLearnerCount isn't known here without an extra roster fetch per
    // assessment (N+1) — the class performance summary only needs
    // markedCount/average/highest/lowest, none of which depend on it, so
    // marks.length is passed as its own total deliberately.
    const stats = calculateMarkStats(marks, assessment.maxMark, marks.length);
    return {
      assessmentId: assessment.id,
      classId: assessment.classId,
      className: context.classesById[assessment.classId]?.name ?? '—',
      subjectId: assessment.subjectId,
      subjectName: context.subjectsById[assessment.subjectId]?.name ?? '—',
      assessmentTitle: assessment.title,
      numberAssessed: stats.markedCount,
      averagePercentage: stats.averagePercentage,
      highestMark: stats.highestMark,
      lowestMark: stats.lowestMark,
      maxMark: assessment.maxMark,
    };
  });

  return { resultRows, classPerformanceRows };
}

export const assessmentReportService = { getAssessmentReport };
