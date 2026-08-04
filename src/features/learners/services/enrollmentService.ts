import { supabase } from '@/lib/supabase';
import type { LearnerEnrollmentRow, LearnerEnrollmentInsert, LearnerEnrollmentUpdate } from '@/lib/database.types';
import type {
  LearnerEnrollment,
  CreateLearnerEnrollmentInput,
  UpdateLearnerEnrollmentInput,
} from '@/features/learners/types/learner.types';

export function toLearnerEnrollment(row: LearnerEnrollmentRow): LearnerEnrollment {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    academicYearId: row.academic_year_id,
    gradeId: row.grade_id,
    classId: row.class_id,
    house: row.house,
    stream: row.stream,
    enrollmentDate: row.enrollment_date,
    enrollmentStatus: row.enrollment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getEnrollments(learnerId: string): Promise<LearnerEnrollment[]> {
  const { data, error } = await supabase
    .from('learner_enrollments')
    .select('*')
    .eq('learner_id', learnerId)
    .order('enrollment_date', { ascending: false });
  if (error) throw error;
  return data.map(toLearnerEnrollment);
}

async function getEnrollment(id: string): Promise<LearnerEnrollment | null> {
  const { data, error } = await supabase.from('learner_enrollments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toLearnerEnrollment(data) : null;
}

async function createEnrollment(
  schoolId: string,
  learnerId: string,
  input: CreateLearnerEnrollmentInput,
): Promise<LearnerEnrollment> {
  const payload: LearnerEnrollmentInsert = {
    school_id: schoolId,
    learner_id: learnerId,
    academic_year_id: input.academicYearId,
    grade_id: input.gradeId,
    class_id: input.classId ?? null,
    house: input.house ?? null,
    stream: input.stream ?? null,
    enrollment_date: input.enrollmentDate,
  };
  const { data, error } = await supabase.from('learner_enrollments').insert(payload).select('*').single();
  if (error) throw error;
  return toLearnerEnrollment(data);
}

async function updateEnrollment(id: string, updates: UpdateLearnerEnrollmentInput): Promise<LearnerEnrollment> {
  const payload: LearnerEnrollmentUpdate = {};
  if (updates.gradeId !== undefined) payload.grade_id = updates.gradeId;
  if (updates.classId !== undefined) payload.class_id = updates.classId;
  if (updates.house !== undefined) payload.house = updates.house;
  if (updates.stream !== undefined) payload.stream = updates.stream;
  if (updates.enrollmentDate !== undefined) payload.enrollment_date = updates.enrollmentDate;
  if (updates.enrollmentStatus !== undefined) payload.enrollment_status = updates.enrollmentStatus;

  const { data, error } = await supabase.from('learner_enrollments').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toLearnerEnrollment(data);
}

/**
 * Atomically marks the learner's currently-enrolled placement as promoted
 * and creates the new academic-year enrollment — calls the SECURITY
 * DEFINER promote_learner() RPC (see supabase/migrations) rather than
 * doing this as two separate client-side writes, which could race.
 */
async function promote(
  learnerId: string,
  newAcademicYearId: string,
  newGradeId: string,
  newClassId: string | null,
): Promise<LearnerEnrollment> {
  const { data, error } = await supabase.rpc('promote_learner', {
    p_learner_id: learnerId,
    p_new_academic_year_id: newAcademicYearId,
    p_new_grade_id: newGradeId,
    p_new_class_id: newClassId,
  });
  if (error) throw error;
  return toLearnerEnrollment(data);
}

export const enrollmentService = {
  getEnrollments,
  getEnrollment,
  createEnrollment,
  updateEnrollment,
  promote,
};
