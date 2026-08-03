import { supabase } from '@/lib/supabase';
import type { AcademicYearRow, AcademicYearInsert, AcademicYearUpdate } from '@/lib/database.types';
import type { AcademicYear, CreateAcademicYearInput, UpdateAcademicYearInput } from '@/features/academic/types/academic.types';

/** Exported so other academic services (terms) can reuse it instead of re-declaring their own mapper. */
export function toAcademicYear(row: AcademicYearRow): AcademicYear {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** RLS (academic_years_select, can_view_academic) scopes this to the caller's own tenant and role automatically. */
async function getAcademicYears(schoolId: string): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('school_id', schoolId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data.map(toAcademicYear);
}

async function getAcademicYear(id: string): Promise<AcademicYear | null> {
  const { data, error } = await supabase.from('academic_years').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toAcademicYear(data) : null;
}

async function createAcademicYear(schoolId: string, input: CreateAcademicYearInput): Promise<AcademicYear> {
  const payload: AcademicYearInsert = {
    school_id: schoolId,
    name: input.name,
    start_date: input.startDate,
    end_date: input.endDate,
  };
  const { data, error } = await supabase.from('academic_years').insert(payload).select('*').single();
  if (error) throw error;
  return toAcademicYear(data);
}

/**
 * General field edits only (name/dates). Does not — and per
 * prevent_direct_year_activation() at the database layer, cannot — set
 * is_active: true directly; use setActiveAcademicYear for that. Archiving
 * (is_active: false) is a normal update, since the DB only guards the
 * false -> true transition.
 */
async function updateAcademicYear(id: string, updates: UpdateAcademicYearInput): Promise<AcademicYear> {
  const payload: AcademicYearUpdate = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;

  const { data, error } = await supabase.from('academic_years').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toAcademicYear(data);
}

/** Archives (deactivates) an academic year without designating a replacement. A plain UPDATE — see updateAcademicYear. */
async function archiveAcademicYear(id: string): Promise<AcademicYear> {
  const { data, error } = await supabase
    .from('academic_years')
    .update({ is_active: false })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return toAcademicYear(data);
}

/**
 * The only path that may activate an academic year — calls the
 * SECURITY DEFINER set_active_academic_year() RPC, which atomically
 * deactivates whatever was previously active for the school and activates
 * this one in a single transaction (see supabase/migrations).
 */
async function setActiveAcademicYear(id: string): Promise<AcademicYear> {
  const { data, error } = await supabase.rpc('set_active_academic_year', { p_academic_year_id: id });
  if (error) throw error;
  return toAcademicYear(data);
}

export const academicYearService = {
  getAcademicYears,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  archiveAcademicYear,
  setActiveAcademicYear,
};
