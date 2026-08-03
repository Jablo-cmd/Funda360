import { supabase } from '@/lib/supabase';
import type { ClassRow, ClassInsert, ClassUpdate } from '@/lib/database.types';
import type { Class, CreateClassInput, UpdateClassInput } from '@/features/academic/types/academic.types';

export function toClass(row: ClassRow): Class {
  return {
    id: row.id,
    gradeId: row.grade_id,
    schoolId: row.school_id,
    name: row.name,
    capacity: row.capacity,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getClasses(schoolId: string): Promise<Class[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map(toClass);
}

async function getClass(id: string): Promise<Class | null> {
  const { data, error } = await supabase.from('classes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toClass(data) : null;
}

/**
 * school_id is set from the caller's active school, not trusted from the
 * client input shape — it must match the referenced grade's school_id or
 * the classes_validate_grade_school() trigger rejects the insert (see
 * supabase/migrations).
 */
async function createClass(schoolId: string, input: CreateClassInput): Promise<Class> {
  const payload: ClassInsert = {
    school_id: schoolId,
    grade_id: input.gradeId,
    name: input.name,
    capacity: input.capacity,
  };
  const { data, error } = await supabase.from('classes').insert(payload).select('*').single();
  if (error) throw error;
  return toClass(data);
}

async function updateClass(id: string, updates: UpdateClassInput): Promise<Class> {
  const payload: ClassUpdate = {};
  if (updates.gradeId !== undefined) payload.grade_id = updates.gradeId;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.capacity !== undefined) payload.capacity = updates.capacity;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase.from('classes').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toClass(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. */
async function archiveClass(id: string): Promise<Class> {
  return updateClass(id, { active: false });
}

async function restoreClass(id: string): Promise<Class> {
  return updateClass(id, { active: true });
}

export const classService = {
  getClasses,
  getClass,
  createClass,
  updateClass,
  archiveClass,
  restoreClass,
};
