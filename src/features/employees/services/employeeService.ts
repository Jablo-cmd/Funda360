import { supabase } from '@/lib/supabase';
import type { EmployeeRow, EmployeeInsert, EmployeeUpdate } from '@/lib/database.types';
import type {
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeesListFilters,
  EmployeesListPage,
  ProvisionableRole,
  ProvisionLoginResult,
} from '@/features/employees/types/employee.types';

const DEFAULT_PAGE_SIZE = 20;

export interface EmployeeCandidate {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Search-driven candidate lookup for the "reports to" picker — the staff
 * directory is paginated (see getEmployees below), so a plain `<select>`
 * fed by whatever page happens to be loaded would silently omit most of the
 * school's employees. Mirrors guardianService.searchGuardianCandidates'
 * shape for the same reason: a potentially large related-entity set.
 */
async function searchEmployeeCandidates(schoolId: string, search = '', excludeId?: string): Promise<EmployeeCandidate[]> {
  let query = supabase
    .from('employees')
    .select('id, first_name, last_name')
    .eq('school_id', schoolId);

  if (excludeId) query = query.neq('id', excludeId);

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[%,]/g, '');
    query = query.or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`);
  }

  const { data, error } = await query.order('first_name', { ascending: true }).limit(20);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name }));
}

/** Exported so other employee-adjacent services can reuse it instead of re-declaring their own mapper. */
export function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    schoolId: row.school_id,
    profileId: row.profile_id,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    workEmail: row.work_email,
    workPhone: row.work_phone,
    idNumber: row.id_number,
    dateOfBirth: row.date_of_birth,
    departmentId: row.department_id,
    jobTitle: row.job_title,
    employmentType: row.employment_type,
    employmentStatus: row.employment_status,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    reportsToEmployeeId: row.reports_to_employee_id,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Server-side pagination, the same judgment call as learnerService.getLearners
 * (see its own comment) — staff directories scale with headcount, not with a
 * small bounded catalogue like departments, so an unpaginated fetch (the
 * Academic Structure precedent) isn't appropriate here.
 */
async function getEmployees(
  schoolId: string,
  filters: EmployeesListFilters = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<EmployeesListPage> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('employees').select('*', { count: 'exact' }).eq('school_id', schoolId);

  const term = filters.search?.trim();
  if (term) {
    const escaped = term.replace(/[%,]/g, '');
    query = query.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,employee_number.ilike.%${escaped}%,job_title.ilike.%${escaped}%`,
    );
  }
  if (filters.employmentStatus) query = query.eq('employment_status', filters.employmentStatus);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);

  const { data, error, count } = await query.order('last_name', { ascending: true }).range(from, to);
  if (error) throw error;

  return {
    employees: data.map(toEmployee),
    totalCount: count ?? 0,
    page,
    pageSize,
  };
}

async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase.from('employees').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toEmployee(data) : null;
}

/** Self-service: the employee record linked to the caller's own profile, if any. RLS (employees_select's `profile_id = auth.uid()` clause) is what actually confines this to the caller's own row. */
async function getMyEmployee(profileId: string): Promise<Employee | null> {
  const { data, error } = await supabase.from('employees').select('*').eq('profile_id', profileId).maybeSingle();
  if (error) throw error;
  return data ? toEmployee(data) : null;
}

function toInsertPayload(schoolId: string, input: CreateEmployeeInput): EmployeeInsert {
  return {
    school_id: schoolId,
    employee_number: input.employeeNumber,
    first_name: input.firstName,
    last_name: input.lastName,
    work_email: input.workEmail ?? null,
    work_phone: input.workPhone ?? null,
    id_number: input.idNumber ?? null,
    date_of_birth: input.dateOfBirth ?? null,
    department_id: input.departmentId ?? null,
    job_title: input.jobTitle ?? null,
    employment_type: input.employmentType ?? null,
    hire_date: input.hireDate,
    reports_to_employee_id: input.reportsToEmployeeId ?? null,
    emergency_contact_name: input.emergencyContactName ?? null,
    emergency_contact_phone: input.emergencyContactPhone ?? null,
  };
}

async function createEmployee(schoolId: string, input: CreateEmployeeInput): Promise<Employee> {
  const { data, error } = await supabase.from('employees').insert(toInsertPayload(schoolId, input)).select('*').single();
  if (error) throw error;
  return toEmployee(data);
}

async function updateEmployee(id: string, updates: UpdateEmployeeInput): Promise<Employee> {
  const payload: EmployeeUpdate = {};
  if (updates.employeeNumber !== undefined) payload.employee_number = updates.employeeNumber;
  if (updates.firstName !== undefined) payload.first_name = updates.firstName;
  if (updates.lastName !== undefined) payload.last_name = updates.lastName;
  if (updates.workEmail !== undefined) payload.work_email = updates.workEmail;
  if (updates.workPhone !== undefined) payload.work_phone = updates.workPhone;
  if (updates.idNumber !== undefined) payload.id_number = updates.idNumber;
  if (updates.dateOfBirth !== undefined) payload.date_of_birth = updates.dateOfBirth;
  if (updates.departmentId !== undefined) payload.department_id = updates.departmentId;
  if (updates.jobTitle !== undefined) payload.job_title = updates.jobTitle;
  if (updates.employmentType !== undefined) payload.employment_type = updates.employmentType;
  if (updates.hireDate !== undefined) payload.hire_date = updates.hireDate;
  if (updates.reportsToEmployeeId !== undefined) payload.reports_to_employee_id = updates.reportsToEmployeeId;
  if (updates.emergencyContactName !== undefined) payload.emergency_contact_name = updates.emergencyContactName;
  if (updates.emergencyContactPhone !== undefined) payload.emergency_contact_phone = updates.emergencyContactPhone;

  const { data, error } = await supabase.from('employees').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return toEmployee(data);
}

/**
 * The only path that terminates an employee — calls the SECURITY DEFINER
 * terminate_employee() RPC, which atomically sets employment_status and, if
 * a login is linked, deactivates it in the same transaction (see
 * supabase/migrations).
 */
async function terminate(id: string, terminationDate: string): Promise<Employee> {
  const { data, error } = await supabase.rpc('terminate_employee', {
    p_employee_id: id,
    p_termination_date: terminationDate,
  });
  if (error) throw error;
  return toEmployee(data);
}

/** Calls the SECURITY DEFINER reactivate_employee() RPC — deliberately does not touch a linked login's status (see the RPC's own comment). */
async function reactivate(id: string): Promise<Employee> {
  const { data, error } = await supabase.rpc('reactivate_employee', { p_employee_id: id });
  if (error) throw error;
  return toEmployee(data);
}

/**
 * The only path that provisions a login for an existing employee — calls
 * the SECURITY DEFINER provision_employee_login() RPC (see
 * supabase/migrations), which seeds profiles.first_name/last_name from the
 * employee's own name once at creation (never synced afterward) and links
 * employees.profile_id back to the new profile in the same transaction.
 * Rejects (server-side) if the employee already has a linked login, has no
 * work_email, the email is already registered, or the role isn't in the
 * provisionable set.
 */
async function provisionLogin(
  employeeId: string,
  role: ProvisionableRole,
  phone: string | null = null,
): Promise<ProvisionLoginResult> {
  const { data, error } = await supabase.rpc('provision_employee_login', {
    p_employee_id: employeeId,
    p_role: role,
    p_phone: phone,
  });
  if (error) throw error;

  const row = data[0];
  if (!row) throw new Error('Login provisioning did not return the expected result.');
  return { userId: row.user_id, temporaryPassword: row.temporary_password };
}

export const employeeService = {
  getEmployees,
  getEmployee,
  getMyEmployee,
  searchEmployeeCandidates,
  createEmployee,
  updateEmployee,
  terminate,
  reactivate,
  provisionLogin,
};
