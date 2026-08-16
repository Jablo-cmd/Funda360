import { supabase } from '@/lib/supabase';
import type {
  ClassTeacherAssignmentRow,
  ClassTeacherAssignmentInsert,
  ClassTeacherAssignmentUpdate,
} from '@/lib/database.types';
import type {
  ClassTeacherAssignment,
  CreateClassTeacherAssignmentInput,
} from '@/features/teaching/types/teaching.types';

export interface TeacherCandidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/**
 * Only profiles holding one of the three teaching roles can plausibly be
 * assigned — mirrors guardianService.searchGuardianCandidates' shape
 * (search-driven, not a plain <select> over a full directory) for the same
 * reason: the staff directory can be large.
 */
async function searchTeacherCandidates(schoolId: string, search = ''): Promise<TeacherCandidate[]> {
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', schoolId)
    .in('role', ['teacher', 'class_teacher', 'subject_teacher']);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,]/g, '');
    query = query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data, error } = await query.order('first_name', { ascending: true }).limit(20);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email }));
}

/** Batch profile lookup for rendering teacher names — avoids the 20-row limit on searchTeacherCandidates, same pattern as guardianService.getGuardianCandidatesByIds. */
async function getTeacherCandidatesByIds(ids: string[]): Promise<TeacherCandidate[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', ids);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email }));
}

export function toClassTeacherAssignment(row: ClassTeacherAssignmentRow): ClassTeacherAssignment {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    teacherProfileId: row.teacher_profile_id,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAssignments(schoolId: string): Promise<ClassTeacherAssignment[]> {
  const { data, error } = await supabase
    .from('class_teacher_assignments')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toClassTeacherAssignment);
}

/** Self-service: "my classes" for the signed-in teacher. RLS (can_view_academic) already permits this — the eq() is the actual scoping, not a security boundary on its own. */
async function getMyAssignments(teacherProfileId: string): Promise<ClassTeacherAssignment[]> {
  const { data, error } = await supabase
    .from('class_teacher_assignments')
    .select('*')
    .eq('teacher_profile_id', teacherProfileId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(toClassTeacherAssignment);
}

async function createAssignment(schoolId: string, input: CreateClassTeacherAssignmentInput): Promise<ClassTeacherAssignment> {
  const payload: ClassTeacherAssignmentInsert = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    class_id: input.classId,
    subject_id: input.subjectId?.trim() || null,
    teacher_profile_id: input.teacherProfileId,
  };
  const { data, error } = await supabase.from('class_teacher_assignments').insert(payload).select('*').single();
  if (error) throw error;
  return toClassTeacherAssignment(data);
}

async function updateAssignment(id: string, updates: ClassTeacherAssignmentUpdate): Promise<ClassTeacherAssignment> {
  const { data, error } = await supabase
    .from('class_teacher_assignments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toClassTeacherAssignment(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false, same pattern as departmentService/classService. */
async function archiveAssignment(id: string): Promise<ClassTeacherAssignment> {
  return updateAssignment(id, { active: false });
}

async function restoreAssignment(id: string): Promise<ClassTeacherAssignment> {
  return updateAssignment(id, { active: true });
}

export const teachingAssignmentService = {
  getAssignments,
  getMyAssignments,
  createAssignment,
  archiveAssignment,
  restoreAssignment,
  searchTeacherCandidates,
  getTeacherCandidatesByIds,
};
