import { supabase } from '@/lib/supabase';
import type { SubjectRow, SubjectInsert, SubjectUpdate } from '@/lib/database.types';
import type { Subject, CreateSubjectInput, UpdateSubjectInput } from '@/features/academic/types/academic.types';

export function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    code: row.code,
    description: row.description,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSubjects(schoolId: string): Promise<Subject[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data.map(toSubject);
}

async function getSubject(id: string): Promise<Subject | null> {
  const { data, error } = await supabase.from('subjects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toSubject(data) : null;
}

async function createSubject(schoolId: string, input: CreateSubjectInput): Promise<Subject> {
  const payload: SubjectInsert = {
    school_id: schoolId,
    name: input.name,
    code: input.code ?? null,
    description: input.description ?? null,
  };
  const { data, error } = await supabase.from('subjects').insert(payload).select('*').single();
  if (error) throw error;
  return toSubject(data);
}

async function updateSubject(id: string, updates: UpdateSubjectInput): Promise<Subject> {
  const payload: SubjectUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.code !== undefined) payload.code = updates.code;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase.from('subjects').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toSubject(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. */
async function archiveSubject(id: string): Promise<Subject> {
  return updateSubject(id, { active: false });
}

async function restoreSubject(id: string): Promise<Subject> {
  return updateSubject(id, { active: true });
}

export const subjectService = {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  archiveSubject,
  restoreSubject,
};
