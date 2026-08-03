import { supabase } from '@/lib/supabase';
import type { GradeRow, GradeInsert, GradeUpdate } from '@/lib/database.types';
import type { Grade, CreateGradeInput, UpdateGradeInput } from '@/features/academic/types/academic.types';

/** Exported so classService can reuse it instead of re-declaring its own mapper. */
export function toGrade(row: GradeRow): Grade {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    code: row.code,
    description: row.description,
    sortOrder: row.sort_order,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getGrades(schoolId: string): Promise<Grade[]> {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data.map(toGrade);
}

async function getGrade(id: string): Promise<Grade | null> {
  const { data, error } = await supabase.from('grades').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toGrade(data) : null;
}

async function createGrade(schoolId: string, input: CreateGradeInput): Promise<Grade> {
  const payload: GradeInsert = {
    school_id: schoolId,
    name: input.name,
    code: input.code ?? null,
    description: input.description ?? null,
    sort_order: input.sortOrder ?? 0,
  };
  const { data, error } = await supabase.from('grades').insert(payload).select('*').single();
  if (error) throw error;
  return toGrade(data);
}

async function updateGrade(id: string, updates: UpdateGradeInput): Promise<Grade> {
  const payload: GradeUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.code !== undefined) payload.code = updates.code;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase.from('grades').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toGrade(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. */
async function archiveGrade(id: string): Promise<Grade> {
  return updateGrade(id, { active: false });
}

async function restoreGrade(id: string): Promise<Grade> {
  return updateGrade(id, { active: true });
}

export const gradeService = {
  getGrades,
  getGrade,
  createGrade,
  updateGrade,
  archiveGrade,
  restoreGrade,
};
