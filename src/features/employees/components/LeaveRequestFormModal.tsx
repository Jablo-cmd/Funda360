import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { leaveRequestService } from '@/features/employees/services/leaveRequestService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  leaveRequestSchema,
  leaveRequestDefaultValues,
  type LeaveRequestFormValues,
} from '@/features/employees/schemas/leaveRequestSchema';
import { LEAVE_TYPE_LABELS } from '@/features/employees/constants/leaveRequestLabels';

export interface LeaveRequestFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  employeeId: string;
  onSaved: () => void;
}

export function LeaveRequestFormModal({ isOpen, onClose, schoolId, employeeId, onSaved }: LeaveRequestFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveRequestFormValues>({ resolver: zodResolver(leaveRequestSchema), defaultValues: leaveRequestDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(leaveRequestDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: LeaveRequestFormValues) => {
    setSubmitError(null);
    try {
      await leaveRequestService.createRequest(schoolId, employeeId, values);
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to submit your leave request.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request leave"
      footer={
        <Button type="submit" form="leave-request-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit request'}
        </Button>
      }
    >
      <form noValidate id="leave-request-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="leave-type" className="mb-1.5 block text-sm font-medium text-content-primary">
            Leave type
          </label>
          <select
            id="leave-type"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('leaveType')}
          >
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Start date" type="date" required error={errors.startDate?.message} {...register('startDate')} />
          <TextField label="End date" type="date" required error={errors.endDate?.message} {...register('endDate')} />
        </div>

        <TextField label="Reason" required error={errors.reason?.message} {...register('reason')} />
      </form>
    </Modal>
  );
}
