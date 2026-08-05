import { supabase } from '@/lib/supabase';
import type { EmploymentStatus } from '@/features/employees/types/employee.types';
import { countBy } from '@/features/reports/utils/aggregation';
import type { EmployeeReportSummary, EmployeeDepartmentCount, EmployeeStatusCount } from '@/features/reports/types/report.types';

const UNASSIGNED_DEPARTMENT_KEY = 'unassigned';

async function getEmployeeReport(schoolId: string): Promise<EmployeeReportSummary> {
  const [employeesResult, departmentsResult] = await Promise.all([
    supabase.from('employees').select('department_id, employment_status').eq('school_id', schoolId),
    supabase.from('departments').select('id, name').eq('school_id', schoolId),
  ]);
  if (employeesResult.error) throw employeesResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  const employees = employeesResult.data;
  const departmentNameById = new Map(departmentsResult.data.map((department) => [department.id, department.name]));

  const departmentCounts = countBy(employees, (row) => row.department_id ?? UNASSIGNED_DEPARTMENT_KEY);
  const byDepartment: EmployeeDepartmentCount[] = Object.entries(departmentCounts).map(([departmentId, count]) => ({
    departmentId: departmentId === UNASSIGNED_DEPARTMENT_KEY ? null : departmentId,
    departmentName:
      departmentId === UNASSIGNED_DEPARTMENT_KEY
        ? 'Unassigned'
        : (departmentNameById.get(departmentId) ?? 'Unknown department'),
    count,
  }));

  const statusCounts = countBy(employees, (row) => row.employment_status);
  const byStatus: EmployeeStatusCount[] = (Object.entries(statusCounts) as [EmploymentStatus, number][]).map(
    ([status, count]) => ({ status, count }),
  );

  return {
    totalEmployees: employees.length,
    byDepartment,
    byStatus,
  };
}

export const employeeReportService = {
  getEmployeeReport,
};
