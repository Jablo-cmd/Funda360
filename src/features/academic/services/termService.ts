import { supabase } from '@/lib/supabase';
import type { TermRow, TermInsert, TermUpdate } from '@/lib/database.types';
import type { Term, CreateTermInput, UpdateTermInput } from '@/features/academic/types/academic.types';

export function toTerm(row: TermRow): Term {
  return {
    id: row.id,
    academicYearId: row.academic_year_id,
    schoolId: row.school_id,
    name: row.name,
    sequence: row.sequence,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTerms(academicYearId: string): Promise<Term[]> {
  const { data, error } = await supabase
    .from('terms')
    .select('*')
    .eq('academic_year_id', academicYearId)
    .order('sequence', { ascending: true });
  if (error) throw error;
  return data.map(toTerm);
}

async function getTerm(id: string): Promise<Term | null> {
  const { data, error } = await supabase.from('terms').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toTerm(data) : null;
}

/**
 * school_id is set from the caller's active school, not trusted from the
 * client input shape — it must match the referenced academic year's
 * school_id or the terms_validate_academic_year_school() trigger rejects
 * the insert (see supabase/migrations).
 */
async function createTerm(schoolId: string, input: CreateTermInput): Promise<Term> {
  const payload: TermInsert = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    name: input.name,
    sequence: input.sequence,
    start_date: input.startDate,
    end_date: input.endDate,
  };
  const { data, error } = await supabase.from('terms').insert(payload).select('*').single();
  if (error) throw error;
  return toTerm(data);
}

async function updateTerm(id: string, updates: UpdateTermInput): Promise<Term> {
  const payload: TermUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.sequence !== undefined) payload.sequence = updates.sequence;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase.from('terms').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toTerm(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false. */
async function archiveTerm(id: string): Promise<Term> {
  return updateTerm(id, { active: false });
}

async function restoreTerm(id: string): Promise<Term> {
  return updateTerm(id, { active: true });
}

export const termService = {
  getTerms,
  getTerm,
  createTerm,
  updateTerm,
  archiveTerm,
  restoreTerm,
};
