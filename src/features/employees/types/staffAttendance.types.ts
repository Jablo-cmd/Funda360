import type { AttendanceStatus } from '@/features/attendance/types/attendance.types';

export type { AttendanceStatus };

export interface StaffAttendanceRecord {
  id: string;
  schoolId: string;
  employeeId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RosterEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

export interface StaffAttendanceEntry {
  employeeId: string;
  status: AttendanceStatus;
}
