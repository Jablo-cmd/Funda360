import type { EmploymentType, EmploymentStatus } from '@/lib/database.types';

export type { EmploymentType, EmploymentStatus };

/**
 * Roles provisionable through Employee Management's provision_employee_login()
 * — a deliberate subset, mirrored exactly from can_assign_employee_role() in
 * supabase/migrations (see that function's own comment for why this is not
 * ASSIGNABLE_ROLES/can_assign_role() from Users Management: governance roles
 * go through admin_create_user() instead, never through employee onboarding).
 */
export const PROVISIONABLE_ROLES = [
  'hr_manager',
  'teacher',
  'department_head',
  'receptionist',
  'accountant',
  'librarian',
  'admissions_officer',
  'medical_officer',
] as const;
export type ProvisionableRole = (typeof PROVISIONABLE_ROLES)[number];

export const PROVISIONABLE_ROLE_LABELS: Record<ProvisionableRole, string> = {
  hr_manager: 'HR Manager',
  teacher: 'Teacher',
  department_head: 'Department Head',
  receptionist: 'Receptionist',
  accountant: 'Accountant',
  librarian: 'Librarian',
  admissions_officer: 'Admissions Officer',
  medical_officer: 'Medical Officer',
};

export interface ProvisionLoginResult {
  userId: string;
  temporaryPassword: string;
}

export interface Department {
  id: string;
  schoolId: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
}

export interface Employee {
  id: string;
  schoolId: string;
  profileId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  workPhone: string | null;
  idNumber: string | null;
  dateOfBirth: string | null;
  departmentId: string | null;
  jobTitle: string | null;
  employmentType: EmploymentType | null;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  terminationDate: string | null;
  reportsToEmployeeId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail?: string | null;
  workPhone?: string | null;
  idNumber?: string | null;
  dateOfBirth?: string | null;
  departmentId?: string | null;
  jobTitle?: string | null;
  employmentType?: EmploymentType | null;
  hireDate: string;
  reportsToEmployeeId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export interface EmployeesListFilters {
  search?: string;
  employmentStatus?: EmploymentStatus;
  departmentId?: string;
}

export interface EmployeesListPage {
  employees: Employee[];
  totalCount: number;
  page: number;
  pageSize: number;
}
