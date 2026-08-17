import { supabase } from '@/lib/supabase';
import type { AttendanceRecordRow, AttendanceRecordInsert } from '@/lib/database.types';
import type {
  AttendanceRecord,
  AttendanceEntry,
  AttendanceStatusCounts,
  RosterLearner,
} from '@/features/attendance/types/attendance.types';

function toAttendanceRecord(row: AttendanceRecordRow): AttendanceRecord {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    classId: row.class_id,
    learnerId: row.learner_id,
    attendanceDate: row.attendance_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Learners currently enrolled in a class for a given academic year, in the order a register is usually read. */
async function getClassRoster(classId: string, academicYearId: string): Promise<RosterLearner[]> {
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('learner_enrollments')
    .select('learner_id')
    .eq('class_id', classId)
    .eq('academic_year_id', academicYearId)
    .eq('enrollment_status', 'enrolled');
  if (enrollmentsError) throw enrollmentsError;

  const learnerIds = enrollments.map((row) => row.learner_id);
  if (learnerIds.length === 0) return [];

  const { data: learners, error: learnersError } = await supabase
    .from('learners')
    .select('id, first_name, last_name, learner_number')
    .in('id', learnerIds)
    .order('last_name', { ascending: true });
  if (learnersError) throw learnersError;

  return learners.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    learnerNumber: row.learner_number,
  }));
}

/** Attendance already recorded for a class on a given date, if the register has been taken. */
async function getAttendanceForClassDate(classId: string, date: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('class_id', classId)
    .eq('attendance_date', date);
  if (error) throw error;
  return data.map(toAttendanceRecord);
}

/**
 * Marks the whole register for a class/date in one request — an upsert
 * targeting the (learner_id, class_id, attendance_date) unique index, so
 * re-saving corrects existing rows instead of erroring on a duplicate.
 */
async function saveAttendance(
  schoolId: string,
  academicYearId: string,
  classId: string,
  date: string,
  entries: AttendanceEntry[],
): Promise<AttendanceRecord[]> {
  const payload: AttendanceRecordInsert[] = entries.map((entry) => ({
    school_id: schoolId,
    academic_year_id: academicYearId,
    class_id: classId,
    learner_id: entry.learnerId,
    attendance_date: date,
    status: entry.status,
  }));

  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(payload, { onConflict: 'learner_id,class_id,attendance_date' })
    .select('*');
  if (error) throw error;
  return data.map(toAttendanceRecord);
}

/** Status breakdown across every class marked for the school on a given date — used by the dashboard's Attendance Overview panel. Only counts registers actually taken; classes not yet marked simply aren't represented. */
async function getSchoolAttendanceSummary(schoolId: string, date: string): Promise<AttendanceStatusCounts> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('status')
    .eq('school_id', schoolId)
    .eq('attendance_date', date);
  if (error) throw error;

  const counts: AttendanceStatusCounts = { present: 0, absent: 0, late: 0 };
  for (const row of data) counts[row.status] += 1;
  return counts;
}

export const attendanceService = {
  getClassRoster,
  getAttendanceForClassDate,
  saveAttendance,
  getSchoolAttendanceSummary,
};
