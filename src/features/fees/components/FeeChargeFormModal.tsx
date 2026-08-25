import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { feeService } from '@/features/fees/services/feeService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { feeChargeSchema, feeChargeDefaultValues, type FeeChargeFormValues } from '@/features/fees/schemas/feeChargeSchema';

export interface FeeChargeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<FeeChargeFormValues['category'], string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Other',
};

export function FeeChargeFormModal({ isOpen, onClose, schoolId, learnerId, academicYearId, onSaved }: FeeChargeFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeeChargeFormValues>({ resolver: zodResolver(feeChargeSchema), defaultValues: feeChargeDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(feeChargeDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: FeeChargeFormValues) => {
    setSubmitError(null);
    try {
      await feeService.createCharge(schoolId, learnerId, {
        academicYearId,
        description: values.description,
        category: values.category,
        amount: values.amount,
        dueDate: values.dueDate || null,
        notes: values.notes?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to add charge.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add charge"
      footer={
        <Button type="submit" form="fee-charge-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Add charge'}
        </Button>
      }
    >
      <form noValidate id="fee-charge-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <TextField
          label="Description"
          required
          placeholder="Term 1 tuition"
          error={errors.description?.message}
          {...register('description')}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fee-charge-category" className="mb-1.5 block text-sm font-medium text-content-primary">
              Category
            </label>
            <select
              id="fee-charge-category"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('category')}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label="Amount"
            type="number"
            step="0.01"
            min={0.01}
            required
            error={errors.amount?.message}
            {...register('amount')}
          />
        </div>

        <TextField label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
        <TextField label="Notes" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
