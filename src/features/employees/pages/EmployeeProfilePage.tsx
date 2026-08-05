import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useEmployee } from '@/features/employees/hooks/useEmployee';
import { useDepartments } from '@/features/employees/hooks/useDepartments';
import { employeeService } from '@/features/employees/services/employeeService';
import { EmployeeFormModal } from '@/features/employees/components/EmployeeFormModal';
import { TerminateEmployeeDialog } from '@/features/employees/components/TerminateEmployeeDialog';
import { ReactivateEmployeeDialog } from '@/features/employees/components/ReactivateEmployeeDialog';
import { ProvisionLoginModal } from '@/features/employees/components/ProvisionLoginModal';
import type { Employee } from '@/features/employees/types/employee.types';

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('employee.manage');
  const { school } = useSchool();
  const { employee, isLoading, error, refetch } = useEmployee(id);
  const { departments } = useDepartments(school?.id);

  const [manager, setManager] = useState<Employee | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTerminateOpen, setIsTerminateOpen] = useState(false);
  const [isReactivateOpen, setIsReactivateOpen] = useState(false);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);

  useEffect(() => {
    if (!employee?.reportsToEmployeeId) {
      setManager(null);
      return;
    }
    let cancelled = false;
    void employeeService.getEmployee(employee.reportsToEmployeeId).then((result) => {
      if (!cancelled) setManager(result);
    });
    return () => {
      cancelled = true;
    };
  }, [employee?.reportsToEmployeeId]);

  if (isLoading) {
    return <FullScreenSpinner label="Loading employee…" />;
  }

  if (error) {
    return <FullScreenNotice title="Something went wrong" message={error} />;
  }

  if (!employee) {
    return (
      <FullScreenNotice
        title="Employee not found"
        message="This employee doesn't exist, or you don't have access to view them."
        action={
          <Link to="/employees" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline">
            Back to Employees
          </Link>
        }
      />
    );
  }

  const departmentName = departments.find((department) => department.id === employee.departmentId)?.name ?? '—';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/employees')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Employees
      </button>

      <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
              {employee.firstName[0]}
              {employee.lastName[0]}
            </span>
            <div>
              <h1 className="text-xl font-bold text-content-primary">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="text-sm text-content-secondary">
                {employee.employeeNumber} · {employee.jobTitle ?? 'No job title'}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            {employee.employmentStatus.replace(/_/g, ' ')}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Department</dt>
            <dd className="mt-1 text-sm text-content-primary">{departmentName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Employment type</dt>
            <dd className="mt-1 text-sm capitalize text-content-primary">
              {employee.employmentType?.replace(/_/g, ' ') ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Hire date</dt>
            <dd className="mt-1 text-sm text-content-primary">{employee.hireDate}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Termination date</dt>
            <dd className="mt-1 text-sm text-content-primary">{employee.terminationDate ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Work email</dt>
            <dd className="mt-1 text-sm text-content-primary">{employee.workEmail ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Work phone</dt>
            <dd className="mt-1 text-sm text-content-primary">{employee.workPhone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">ID number</dt>
            <dd className="mt-1 text-sm text-content-primary">{employee.idNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Reports to</dt>
            <dd className="mt-1 text-sm text-content-primary">
              {manager ? `${manager.firstName} ${manager.lastName}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-content-tertiary">Emergency contact</dt>
            <dd className="mt-1 text-sm text-content-primary">
              {employee.emergencyContactName
                ? [employee.emergencyContactName, employee.emergencyContactPhone].filter(Boolean).join(' · ')
                : '—'}
            </dd>
          </div>
        </dl>

        {canManage && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
            <div className="w-full sm:w-auto sm:min-w-[8rem]">
              <Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>
                Edit details
              </Button>
            </div>
            {!employee.profileId && (
              <div className="w-full sm:w-auto sm:min-w-[8rem]">
                <Button type="button" variant="secondary" onClick={() => setIsProvisionOpen(true)}>
                  Provision login
                </Button>
              </div>
            )}
            {employee.employmentStatus === 'terminated' ? (
              <div className="w-full sm:w-auto sm:min-w-[8rem]">
                <Button type="button" variant="secondary" onClick={() => setIsReactivateOpen(true)}>
                  Reactivate
                </Button>
              </div>
            ) : (
              <div className="w-full sm:w-auto sm:min-w-[8rem]">
                <Button type="button" variant="secondary" onClick={() => setIsTerminateOpen(true)}>
                  Terminate
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {school && (
        <EmployeeFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          schoolId={school.id}
          employee={employee}
          departments={departments}
          onSaved={() => void refetch()}
        />
      )}
      <TerminateEmployeeDialog
        isOpen={isTerminateOpen}
        onClose={() => setIsTerminateOpen(false)}
        employee={employee}
        onTerminated={() => void refetch()}
      />
      <ReactivateEmployeeDialog
        isOpen={isReactivateOpen}
        onClose={() => setIsReactivateOpen(false)}
        employee={employee}
        onReactivated={() => void refetch()}
      />
      <ProvisionLoginModal
        isOpen={isProvisionOpen}
        onClose={() => setIsProvisionOpen(false)}
        employee={employee}
        onProvisioned={() => void refetch()}
      />
    </div>
  );
}
