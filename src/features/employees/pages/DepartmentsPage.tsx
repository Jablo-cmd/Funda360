import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useDepartments } from '@/features/employees/hooks/useDepartments';
import { departmentService } from '@/features/employees/services/departmentService';
import { DepartmentsTable } from '@/features/employees/components/DepartmentsTable';
import { DepartmentFormModal } from '@/features/employees/components/DepartmentFormModal';
import type { Department } from '@/features/employees/types/employee.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('employee.manage');
  const { school } = useSchool();
  const { departments, isLoading, error, refetch } = useDepartments(school?.id);

  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleDepartments = showArchived
    ? departments
    : departments.filter((department) => department.active);

  const openCreate = () => {
    setEditingDepartment(null);
    setIsFormOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditingDepartment(department);
    setIsFormOpen(true);
  };

  const handleToggleActive = async (department: Department) => {
    setActionError(null);
    try {
      if (department.active) {
        await departmentService.archiveDepartment(department.id);
      } else {
        await departmentService.restoreDepartment(department.id);
      }
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to update department.'));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/employees')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Employees
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Departments</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Manage the department catalogue for your school.
          </p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={openCreate}>
              Add department
            </Button>
          </div>
        )}
      </div>

      <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="focus-ring h-4 w-4 rounded border-border-strong"
        />
        Show archived departments
      </label>

      {(error ?? actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading departments…</span>
        </div>
      ) : (
        <DepartmentsTable
          departments={visibleDepartments}
          canManage={canManage}
          onEdit={openEdit}
          onToggleActive={(department) => void handleToggleActive(department)}
        />
      )}

      {school && (
        <DepartmentFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          department={editingDepartment}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
