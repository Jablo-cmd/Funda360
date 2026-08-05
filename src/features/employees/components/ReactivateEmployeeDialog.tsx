import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { employeeService } from '@/features/employees/services/employeeService';
import type { Employee } from '@/features/employees/types/employee.types';

export interface ReactivateEmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onReactivated: (employee: Employee) => void;
}

export function ReactivateEmployeeDialog({ isOpen, onClose, employee, onReactivated }: ReactivateEmployeeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const updated = await employeeService.reactivate(employee.id);
      onReactivated(updated);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to reactivate employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reactivate employee"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-40">
            <Button type="button" onClick={() => void handleConfirm()} isLoading={isSubmitting}>
              {isSubmitting ? 'Reactivating…' : 'Reactivate'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}
        <p className="text-sm text-content-secondary">
          <span className="font-medium text-content-primary">
            {employee.firstName} {employee.lastName}
          </span>{' '}
          will be marked active again. This does not restore a previously deactivated login.
        </p>
      </div>
    </Modal>
  );
}
