import { supabase } from '@/lib/supabase';
import type { TimetableSubstitutionRow, TimetableSubstitutionInsert } from '@/lib/database.types';
import type {
  TimetableSubstitution,
  CreateTimetableSubstitutionInput,
} from '@/features/timetable/types/substitution.types';

function toSubstitution(row: TimetableSubstitutionRow): TimetableSubstitution {
  return {
    id: row.id,
    schoolId: row.school_id,
    timetableEntryId: row.timetable_entry_id,
    substituteDate: row.substitute_date,
    substituteTeacherProfileId: row.substitute_teacher_profile_id,
    reason: row.reason,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Every substitution for this school's timetable, most recent date first — the Timetable page's own dedicated list (not filtered by entry, since a manager reviewing cover arrangements wants the whole picture at once). */
async function getSubstitutions(schoolId: string): Promise<TimetableSubstitution[]> {
  const { data, error } = await supabase
    .from('timetable_substitutions')
    .select('*')
    .eq('school_id', schoolId)
    .order('substitute_date', { ascending: false });
  if (error) throw error;
  return data.map(toSubstitution);
}

async function createSubstitution(schoolId: string, input: CreateTimetableSubstitutionInput): Promise<TimetableSubstitution> {
  const payload: TimetableSubstitutionInsert = {
    school_id: schoolId,
    timetable_entry_id: input.timetableEntryId,
    substitute_date: input.substituteDate,
    substitute_teacher_profile_id: input.substituteTeacherProfileId,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase.from('timetable_substitutions').insert(payload).select('*').single();
  if (error) throw error;
  return toSubstitution(data);
}

/** A genuine hard delete — timetable_substitutions is the one table in this schema with a real DELETE policy (see the migration's own comment: a dated exception has no meaning once cancelled, unlike every other archive-by-flag entity here). */
async function cancelSubstitution(id: string): Promise<void> {
  const { error } = await supabase.from('timetable_substitutions').delete().eq('id', id);
  if (error) throw error;
}

export const substitutionService = { getSubstitutions, createSubstitution, cancelSubstitution };
