/**
 * Domain types for the Attendance feature. Used only within this feature,
 * so per the type-ownership convention these stay here rather than in the
 * cross-feature src/types/ barrel.
 */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  schoolId: string;
  academicYearId: string;
  classId: string;
  learnerId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RosterLearner {
  id: string;
  firstName: string;
  lastName: string;
  learnerNumber: string;
}

export interface AttendanceEntry {
  learnerId: string;
  status: AttendanceStatus;
}

export interface AttendanceStatusCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
}
