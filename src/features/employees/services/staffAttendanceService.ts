import { supabase } from '@/lib/supabase';
import type { StaffAttendanceRecordRow, StaffAttendanceRecordInsert } from '@/lib/database.types';
import type {
  StaffAttendanceRecord,
  StaffAttendanceEntry,
  RosterEmployee,
} from '@/features/employees/types/staffAttendance.types';

function toStaffAttendanceRecord(row: StaffAttendanceRecordRow): StaffAttendanceRecord {
  return {
    id: row.id,
    schoolId: row.school_id,
    employeeId: row.employee_id,
    attendanceDate: row.attendance_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every active employee, in the order a staff register is usually read — mirrors attendanceService.getClassRoster's own shape, whole-school rather than class-scoped (staff attendance has no class dimension). */
async function getStaffRoster(schoolId: string): Promise<RosterEmployee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, employee_number')
    .eq('school_id', schoolId)
    .eq('employment_status', 'active')
    .order('last_name', { ascending: true });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    employeeNumber: row.employee_number,
  }));
}

/** Staff attendance already recorded for the whole school on a given date, if taken. */
async function getAttendanceForDate(schoolId: string, date: string): Promise<StaffAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('staff_attendance_records')
    .select('*')
    .eq('school_id', schoolId)
    .eq('attendance_date', date);
  if (error) throw error;
  return data.map(toStaffAttendanceRecord);
}

/**
 * Marks the whole staff register for a date in one request — an upsert
 * targeting the (employee_id, attendance_date) unique index, so re-saving
 * corrects existing rows instead of erroring on a duplicate. Mirrors
 * attendanceService.saveAttendance exactly.
 */
async function saveStaffAttendance(schoolId: string, date: string, entries: StaffAttendanceEntry[]): Promise<StaffAttendanceRecord[]> {
  const payload: StaffAttendanceRecordInsert[] = entries.map((entry) => ({
    school_id: schoolId,
    employee_id: entry.employeeId,
    attendance_date: date,
    status: entry.status,
  }));

  const { data, error } = await supabase
    .from('staff_attendance_records')
    .upsert(payload, { onConflict: 'employee_id,attendance_date' })
    .select('*');
  if (error) throw error;
  return data.map(toStaffAttendanceRecord);
}

/** The caller's own attendance history — self-access, no employee.view required (mirrors staff_attendance_records_select's own self-access RLS clause). */
async function getMyAttendance(employeeId: string): Promise<StaffAttendanceRecord[]> {
  const { data, error } = await supabase
    .from('staff_attendance_records')
    .select('*')
    .eq('employee_id', employeeId)
    .order('attendance_date', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data.map(toStaffAttendanceRecord);
}

export const staffAttendanceService = { getStaffRoster, getAttendanceForDate, saveStaffAttendance, getMyAttendance };
