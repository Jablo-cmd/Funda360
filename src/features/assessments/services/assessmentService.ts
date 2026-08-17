import { supabase } from '@/lib/supabase';
import type { AssessmentRow, AssessmentInsert, AssessmentResultRow } from '@/lib/database.types';
import type {
  Assessment,
  AssessmentResult,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  RosterLearner,
  LearnerAssessmentResult,
} from '@/features/assessments/types/assessment.types';

function toAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    title: row.title,
    assessmentType: row.assessment_type,
    assessmentDate: row.assessment_date,
    maxMark: row.max_mark,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAssessmentResult(row: AssessmentResultRow): AssessmentResult {
  return {
    id: row.id,
    schoolId: row.school_id,
    assessmentId: row.assessment_id,
    learnerId: row.learner_id,
    mark: row.mark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * All assessments for a school, optionally filtered — powers the
 * administrative assessments list (filterable by class/subject/term/
 * academic year) and, via the classId filter alone, the "My Classes ->
 * class -> Assessments" teacher workflow. RLS (can_view_academic) is the
 * actual visibility boundary; these filters are just query shape, the same
 * relationship every other *List hook in this codebase has with its RLS
 * policy.
 */
async function getAssessments(
  schoolId: string,
  filters: { classId?: string; subjectId?: string; termId?: string; academicYearId?: string; limit?: number } = {},
): Promise<Assessment[]> {
  let query = supabase.from('assessments').select('*').eq('school_id', schoolId);
  if (filters.classId) query = query.eq('class_id', filters.classId);
  if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters.termId) query = query.eq('term_id', filters.termId);
  if (filters.academicYearId) query = query.eq('academic_year_id', filters.academicYearId);

  query = query.order('assessment_date', { ascending: false });
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(toAssessment);
}

async function getAssessment(id: string): Promise<Assessment | null> {
  const { data, error } = await supabase.from('assessments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toAssessment(data) : null;
}

async function createAssessment(schoolId: string, input: CreateAssessmentInput): Promise<Assessment> {
  const payload: AssessmentInsert = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    term_id: input.termId,
    class_id: input.classId,
    subject_id: input.subjectId,
    title: input.title,
    assessment_type: input.assessmentType,
    assessment_date: input.assessmentDate,
    max_mark: input.maxMark,
  };
  const { data, error } = await supabase.from('assessments').insert(payload).select('*').single();
  if (error) throw error;
  return toAssessment(data);
}

async function updateAssessment(id: string, updates: UpdateAssessmentInput): Promise<Assessment> {
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.assessmentType !== undefined) payload.assessment_type = updates.assessmentType;
  if (updates.assessmentDate !== undefined) payload.assessment_date = updates.assessmentDate;
  if (updates.maxMark !== undefined) payload.max_mark = updates.maxMark;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase.from('assessments').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toAssessment(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false, same pattern as classService/departmentService/teachingAssignmentService. */
async function archiveAssessment(id: string): Promise<Assessment> {
  return updateAssessment(id, { active: false });
}

async function restoreAssessment(id: string): Promise<Assessment> {
  return updateAssessment(id, { active: true });
}

/**
 * Learners currently enrolled in a class for a given academic year, in the
 * order a mark sheet is usually read. Deliberately duplicated from
 * attendanceService.getClassRoster (same two-query shape: enrollments,
 * then learners) rather than extracted into a shared helper — Sprint 6's
 * hardened Attendance surface is left untouched on purpose this sprint,
 * not out of oversight.
 */
async function getClassRoster(classId: string, academicYearId: string): Promise<RosterLearner[]> {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('learner_enrollments')
    .select('learner_id')
    .eq('class_id', classId)
    .eq('academic_year_id', academicYearId)
    .eq('enrollment_status', 'enrolled');
  if (enrollmentsError) throw enrollmentsError;

  const learnerIds = enrollments.map((row) => row.learner_id);
  if (learnerIds.length === 0) return [];

  const { data: learners, error: learnersError } = await supabase
    .from('learners')
    .select('id, first_name, last_name, learner_number')
    .in('id', learnerIds)
    .order('last_name', { ascending: true });
  if (learnersError) throw learnersError;

  return learners.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    learnerNumber: row.learner_number,
  }));
}

/** Every result already recorded for one assessment — one row per marked learner (see the migration for why an unmarked learner has no row at all). */
async function getResultsForAssessment(assessmentId: string): Promise<AssessmentResult[]> {
  const { data, error } = await supabase.from('assessment_results').select('*').eq('assessment_id', assessmentId);
  if (error) throw error;
  return data.map(toAssessmentResult);
}

/** Batch results fetch across several assessments in one request — the Assessment Report page's own concern, kept here since it's the same table/mapper. Avoids one request per assessment (N+1). */
async function getResultsForAssessments(assessmentIds: string[]): Promise<AssessmentResult[]> {
  if (assessmentIds.length === 0) return [];
  const { data, error } = await supabase.from('assessment_results').select('*').in('assessment_id', assessmentIds);
  if (error) throw error;
  return data.map(toAssessmentResult);
}

/**
 * Marks (or corrects) a batch of learners' results in one request — an
 * upsert targeting the (assessment_id, learner_id) unique index, so
 * re-saving corrects existing rows instead of erroring on a duplicate.
 * Only entries the caller actually passes are written — an unmarked
 * learner is simply omitted, never sent as a 0.
 */
async function saveResults(
  schoolId: string,
  assessmentId: string,
  entries: { learnerId: string; mark: number }[],
): Promise<AssessmentResult[]> {
  if (entries.length === 0) return [];

  const payload = entries.map((entry) => ({
    school_id: schoolId,
    assessment_id: assessmentId,
    learner_id: entry.learnerId,
    mark: entry.mark,
  }));

  const { data, error } = await supabase
    .from('assessment_results')
    .upsert(payload, { onConflict: 'assessment_id,learner_id' })
    .select('*');
  if (error) throw error;
  return data.map(toAssessmentResult);
}

/**
 * One learner's full assessment history — results joined to their parent
 * assessment's context (title/type/date/max mark), for the Learner Profile
 * "Academic Results" section. Two flat queries (results, then assessments
 * by id), matching this codebase's established no-embedded-join style
 * rather than a PostgREST embedded select.
 */
async function getResultsForLearner(learnerId: string): Promise<LearnerAssessmentResult[]> {
  const { data: results, error: resultsError } = await supabase
    .from('assessment_results')
    .select('*')
    .eq('learner_id', learnerId);
  if (resultsError) throw resultsError;
  if (results.length === 0) return [];

  const assessmentIds = [...new Set(results.map((row) => row.assessment_id))];
  const { data: assessments, error: assessmentsError } = await supabase
    .from('assessments')
    .select('*')
    .in('id', assessmentIds);
  if (assessmentsError) throw assessmentsError;

  const assessmentsById = new Map(assessments.map((row) => [row.id, row]));

  return results
    .map((result): LearnerAssessmentResult | null => {
      const assessment = assessmentsById.get(result.assessment_id);
      if (!assessment) return null;
      return {
        resultId: result.id,
        assessmentId: assessment.id,
        title: assessment.title,
        assessmentType: assessment.assessment_type,
        assessmentDate: assessment.assessment_date,
        mark: result.mark,
        maxMark: assessment.max_mark,
        subjectId: assessment.subject_id,
        termId: assessment.term_id,
        academicYearId: assessment.academic_year_id,
      };
    })
    .filter((row): row is LearnerAssessmentResult => row !== null)
    .sort((a, b) => b.assessmentDate.localeCompare(a.assessmentDate));
}

export const assessmentService = {
  getAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  archiveAssessment,
  restoreAssessment,
  getClassRoster,
  getResultsForAssessment,
  getResultsForAssessments,
  saveResults,
  getResultsForLearner,
};
