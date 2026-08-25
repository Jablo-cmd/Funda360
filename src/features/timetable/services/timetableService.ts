import { supabase } from '@/lib/supabase';
import type { TimetableEntryRow, TimetableEntryInsert, TimetableEntryUpdate } from '@/lib/database.types';
import type { TimetableEntry, CreateTimetableEntryInput } from '@/features/timetable/types/timetable.types';

export function toTimetableEntry(row: TimetableEntryRow): TimetableEntry {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    classId: row.class_id,
    subjectId: row.subject_id,
    teacherProfileId: row.teacher_profile_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All entries for a school/academic year — filtering by class/teacher/subject/day/archived is done client-side (see useTimetableEntries), matching a single weekly view rarely exceeding a few hundred rows even for a large school. */
async function getEntries(schoolId: string, academicYearId: string): Promise<TimetableEntry[]> {
  const { data, error } = await supabase
    .from('timetable_entries')
    .select('*')
    .eq('school_id', schoolId)
    .eq('academic_year_id', academicYearId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data.map(toTimetableEntry);
}

async function createEntry(schoolId: string, input: CreateTimetableEntryInput): Promise<TimetableEntry> {
  const payload: TimetableEntryInsert = {
    school_id: schoolId,
    academic_year_id: input.academicYearId,
    term_id: input.termId || null,
    class_id: input.classId,
    subject_id: input.subjectId,
    teacher_profile_id: input.teacherProfileId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    room: input.room || null,
  };
  const { data, error } = await supabase.from('timetable_entries').insert(payload).select('*').single();
  if (error) throw error;
  return toTimetableEntry(data);
}

async function updateEntry(id: string, updates: TimetableEntryUpdate): Promise<TimetableEntry> {
  const { data, error } = await supabase.from('timetable_entries').update(updates).eq('id', id).select('*').single();
  if (error) throw error;
  return toTimetableEntry(data);
}

/** Never hard-deleted (no DELETE RLS policy exists for this table) — archiving sets active: false, same pattern as teachingAssignmentService/classService. Archived entries are also exempt from conflict checks (timetable_entries_check_conflicts()), so archiving always succeeds regardless of what else is scheduled. */
async function archiveEntry(id: string): Promise<TimetableEntry> {
  return updateEntry(id, { active: false });
}

async function restoreEntry(id: string): Promise<TimetableEntry> {
  return updateEntry(id, { active: true });
}

export const timetableService = {
  getEntries,
  createEntry,
  updateEntry,
  archiveEntry,
  restoreEntry,
};
