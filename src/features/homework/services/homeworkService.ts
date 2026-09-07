import { supabase } from '@/lib/supabase';
import type { AssignmentRow, AssignmentStatus } from '@/lib/database.types';
import type {
  Assignment,
  AssignmentResource,
  AssignmentSubmission,
  CreateAssignmentInput,
  RubricCriterion,
} from '@/features/homework/types/homework.types';

interface AssignmentJoinRow extends AssignmentRow {
  classes: { name: string } | null;
  subjects: { name: string } | null;
}

function parseRubric(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is { criterion?: unknown; points?: unknown } => typeof v === 'object' && v !== null)
    .map((v) => ({ criterion: String(v.criterion ?? ''), points: Number(v.points ?? 0) }))
    .filter((v) => v.criterion.length > 0);
}

function toAssignment(row: AssignmentJoinRow): Assignment {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    classId: row.class_id,
    className: row.classes?.name ?? null,
    subjectId: row.subject_id,
    subjectName: row.subjects?.name ?? null,
    assessmentId: row.assessment_id,
    title: row.title,
    instructions: row.instructions,
    dueAt: row.due_at,
    maxPoints: row.max_points,
    allowResubmission: row.allow_resubmission,
    status: row.status,
    rubric: parseRubric(row.rubric),
    publishedAt: row.published_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

const ASSIGNMENT_SELECT = '*, classes(name), subjects(name)';

async function listAssignments(
  schoolId: string,
  filters: { classId?: string; subjectId?: string; status?: AssignmentStatus } = {},
): Promise<Assignment[]> {
  let query = supabase
    .from('assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (filters.classId) query = query.eq('class_id', filters.classId);
  if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as AssignmentJoinRow[]).map(toAssignment);
}

async function getAssignment(id: string): Promise<{ assignment: Assignment; resources: AssignmentResource[] }> {
  const [{ data, error }, { data: resources, error: resError }] = await Promise.all([
    supabase.from('assignments').select(ASSIGNMENT_SELECT).eq('id', id).single(),
    supabase.from('assignment_resources').select('id, label, url, storage_path').eq('assignment_id', id),
  ]);
  if (error) throw error;
  if (resError) throw resError;
  return {
    assignment: toAssignment(data as unknown as AssignmentJoinRow),
    resources: (resources ?? []).map((r) => ({ id: r.id, label: r.label, url: r.url, storagePath: r.storage_path })),
  };
}

interface SubmissionJoinRow {
  id: string;
  assignment_id: string;
  learner_id: string;
  status: AssignmentSubmission['status'];
  submission_text: string | null;
  submitted_at: string | null;
  is_late: boolean;
  attempt_count: number;
  points_awarded: number | null;
  rubric_scores: AssignmentSubmission['rubricScores'];
  teacher_feedback: string | null;
  marked_at: string | null;
  returned_at: string | null;
  learners: { first_name: string; last_name: string } | null;
}

function toSubmission(row: SubmissionJoinRow): AssignmentSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    learnerId: row.learner_id,
    learnerName: row.learners ? `${row.learners.first_name} ${row.learners.last_name}`.trim() : null,
    status: row.status,
    submissionText: row.submission_text,
    submittedAt: row.submitted_at,
    isLate: row.is_late,
    attemptCount: row.attempt_count,
    pointsAwarded: row.points_awarded,
    rubricScores: row.rubric_scores,
    teacherFeedback: row.teacher_feedback,
    markedAt: row.marked_at,
    returnedAt: row.returned_at,
  };
}

const SUBMISSION_SELECT =
  'id, assignment_id, learner_id, status, submission_text, submitted_at, is_late, attempt_count, points_awarded, rubric_scores, teacher_feedback, marked_at, returned_at, learners(first_name, last_name)';

async function listSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select(SUBMISSION_SELECT)
    .eq('assignment_id', assignmentId);
  if (error) throw error;
  return (data as unknown as SubmissionJoinRow[]).map(toSubmission).sort((a, b) => (a.learnerName ?? '').localeCompare(b.learnerName ?? ''));
}

/** Assignments any of the given learners have a submission row for (the guardian/learner view). */
async function listAssignmentsForLearners(learnerIds: string[]): Promise<
  Array<{ assignment: Assignment; submission: AssignmentSubmission }>
> {
  if (learnerIds.length === 0) return [];
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select(`${SUBMISSION_SELECT}, assignments(${ASSIGNMENT_SELECT})`)
    .in('learner_id', learnerIds);
  if (error) throw error;
  return (data as unknown as Array<SubmissionJoinRow & { assignments: AssignmentJoinRow }>)
    .filter((r) => r.assignments && r.assignments.status !== 'draft')
    .map((r) => ({ assignment: toAssignment(r.assignments), submission: toSubmission(r) }))
    .sort((a, b) => {
      const da = a.assignment.dueAt ?? a.assignment.createdAt;
      const db = b.assignment.dueAt ?? b.assignment.createdAt;
      return db.localeCompare(da);
    });
}

async function createAssignment(
  schoolId: string,
  academicYearId: string,
  input: CreateAssignmentInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_assignment', {
    p_school_id: schoolId,
    p_class_id: input.classId,
    p_subject_id: input.subjectId,
    p_academic_year_id: academicYearId,
    p_title: input.title,
    p_instructions: input.instructions ?? null,
    p_due_at: input.dueAt ?? null,
    p_max_points: input.maxPoints ?? null,
    p_term_id: input.termId ?? null,
    p_allow_resubmission: input.allowResubmission ?? false,
  });
  if (error) throw error;
  return (data as AssignmentRow).id;
}

async function publishAssignment(id: string): Promise<void> {
  const { error } = await supabase.rpc('publish_assignment', { p_assignment_id: id });
  if (error) throw error;
}

async function closeAssignment(id: string): Promise<void> {
  const { error } = await supabase.rpc('close_assignment', { p_assignment_id: id });
  if (error) throw error;
}

async function submitAssignment(assignmentId: string, learnerId: string, text: string): Promise<void> {
  const { error } = await supabase.rpc('submit_assignment', {
    p_assignment_id: assignmentId,
    p_learner_id: learnerId,
    p_submission_text: text,
  });
  if (error) throw error;
}

async function markSubmission(
  submissionId: string,
  input: { points?: number | null; feedback?: string | null; finalise: boolean },
): Promise<void> {
  const { error } = await supabase.rpc('mark_assignment_submission', {
    p_submission_id: submissionId,
    p_points: input.points ?? null,
    p_feedback: input.feedback ?? null,
    p_finalise: input.finalise,
  });
  if (error) throw error;
}

async function excuseSubmission(submissionId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('excuse_assignment_submission', {
    p_submission_id: submissionId,
    p_reason: reason || null,
  });
  if (error) throw error;
}

export const homeworkService = {
  listAssignments,
  getAssignment,
  listSubmissions,
  listAssignmentsForLearners,
  createAssignment,
  publishAssignment,
  closeAssignment,
  submitAssignment,
  markSubmission,
  excuseSubmission,
};
