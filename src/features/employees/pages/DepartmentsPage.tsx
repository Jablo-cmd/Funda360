import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
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
    <PageContainer>
      <button
        type="button"
        onClick={() => navigate('/employees')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Employees
      </button>

      <PageHeader
        title="Departments"
        description="Manage the department catalogue for your school."
        action={
          canManage &&
          school && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={openCreate}>
                Add department
              </Button>
            </div>
          )
        }
      />

      {school && (
        <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="focus-ring h-4 w-4 rounded border-border-strong"
          />
          Show archived departments
        </label>
      )}

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="departments" />
      ) : isLoading ? (
        <LoadingBlock label="Loading departments…" />
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
    </PageContainer>
  );
}
