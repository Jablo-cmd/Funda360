import type { LearnerStatus } from '@/features/learners/types/learner.types';
import type { EmploymentStatus } from '@/features/employees/types/employee.types';

export interface LearnerStatusCount {
  status: LearnerStatus;
  count: number;
}

export interface LearnerReportSummary {
  totalLearners: number;
  byStatus: LearnerStatusCount[];
}

export interface EmployeeDepartmentCount {
  departmentId: string | null;
  departmentName: string;
  count: number;
}

export interface EmployeeStatusCount {
  status: EmploymentStatus;
  count: number;
}

export interface EmployeeReportSummary {
  totalEmployees: number;
  byDepartment: EmployeeDepartmentCount[];
  byStatus: EmployeeStatusCount[];
}

export interface AcademicEntityCount {
  active: number;
  archived: number;
  total: number;
}

export interface AcademicReportSummary {
  currentAcademicYear: { id: string; name: string } | null;
  grades: AcademicEntityCount;
  classes: AcademicEntityCount;
  subjects: AcademicEntityCount;
  terms: AcademicEntityCount;
}
