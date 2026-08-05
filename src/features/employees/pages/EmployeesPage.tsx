import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useEmployeesList } from '@/features/employees/hooks/useEmployeesList';
import { useDepartments } from '@/features/employees/hooks/useDepartments';
import { EmployeesFiltersBar } from '@/features/employees/components/EmployeesFiltersBar';
import { EmployeesTable } from '@/features/employees/components/EmployeesTable';
import { EmployeesPagination } from '@/features/employees/components/EmployeesPagination';
import { EmployeeFormModal } from '@/features/employees/components/EmployeeFormModal';
import { TerminateEmployeeDialog } from '@/features/employees/components/TerminateEmployeeDialog';
import { ReactivateEmployeeDialog } from '@/features/employees/components/ReactivateEmployeeDialog';
import type { Employee } from '@/features/employees/types/employee.types';

export function EmployeesPage() {
  const { can } = usePermissions();
  const canManage = can('employee.manage');
  const { school } = useSchool();
  const { employees, totalCount, page, pageSize, isLoading, error, filters, setFilters, setPage, refetch } =
    useEmployeesList(school?.id);
  const { departments } = useDepartments(school?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [terminatingEmployee, setTerminatingEmployee] = useState<Employee | null>(null);
  const [reactivatingEmployee, setReactivatingEmployee] = useState<Employee | null>(null);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Employees</h1>
          <p className="mt-1 text-sm text-content-secondary">Manage the staff directory for your school.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/employees/departments"
            className="focus-ring flex h-11 items-center rounded-lg px-3.5 text-sm font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
          >
            Manage departments
          </Link>
          {canManage && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={() => setIsCreateOpen(true)}>
                Add employee
              </Button>
            </div>
          )}
        </div>
      </div>

      <EmployeesFiltersBar filters={filters} departments={departments} onChange={setFilters} />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading employees…</span>
        </div>
      ) : (
        <>
          <EmployeesTable
            employees={employees}
            departments={departments}
            canManage={canManage}
            onEdit={setEditingEmployee}
            onTerminate={setTerminatingEmployee}
            onReactivate={setReactivatingEmployee}
          />
          <EmployeesPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}

      {school && (
        <EmployeeFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          schoolId={school.id}
          departments={departments}
          onSaved={() => void refetch()}
        />
      )}

      {editingEmployee && school && (
        <EmployeeFormModal
          isOpen={Boolean(editingEmployee)}
          onClose={() => setEditingEmployee(null)}
          schoolId={school.id}
          employee={editingEmployee}
          departments={departments}
          onSaved={() => void refetch()}
        />
      )}
      {terminatingEmployee && (
        <TerminateEmployeeDialog
          isOpen={Boolean(terminatingEmployee)}
          onClose={() => setTerminatingEmployee(null)}
          employee={terminatingEmployee}
          onTerminated={() => void refetch()}
        />
      )}
      {reactivatingEmployee && (
        <ReactivateEmployeeDialog
          isOpen={Boolean(reactivatingEmployee)}
          onClose={() => setReactivatingEmployee(null)}
          employee={reactivatingEmployee}
          onReactivated={() => void refetch()}
        />
      )}
    </div>
  );
}
