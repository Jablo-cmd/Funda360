import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { feeService } from '@/features/fees/services/feeService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { feeStructureSchema, feeStructureDefaultValues, type FeeStructureFormValues } from '@/features/fees/schemas/feeStructureSchema';
import type { Grade } from '@/features/academic/types/academic.types';

export interface FeeStructureFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYearId: string;
  grades: Grade[];
  onSaved: () => void;
}

const CATEGORY_LABELS: Record<FeeStructureFormValues['category'], string> = {
  tuition: 'Tuition',
  transport: 'Transport',
  boarding: 'Boarding',
  uniform: 'Uniform',
  activity: 'Activity',
  other: 'Other',
};

export function FeeStructureFormModal({ isOpen, onClose, schoolId, academicYearId, grades, onSaved }: FeeStructureFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FeeStructureFormValues>({ resolver: zodResolver(feeStructureSchema), defaultValues: feeStructureDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(feeStructureDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: FeeStructureFormValues) => {
    setSubmitError(null);
    try {
      await feeService.createFeeStructure(schoolId, {
        academicYearId,
        gradeId: values.gradeId || null,
        name: values.name,
        category: values.category,
        amount: values.amount,
        description: values.description?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to add fee structure.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add fee structure"
      footer={
        <Button type="submit" form="fee-structure-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Add fee structure'}
        </Button>
      }
    >
      <form noValidate id="fee-structure-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <TextField label="Name" required placeholder="Term 1 Tuition — Grade 8" error={errors.name?.message} {...register('name')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fee-structure-category" className="mb-1.5 block text-sm font-medium text-content-primary">
              Category
            </label>
            <select
              id="fee-structure-category"
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

        <div>
          <label htmlFor="fee-structure-grade" className="mb-1.5 block text-sm font-medium text-content-primary">
            Grade (optional — leave blank to apply to any grade)
          </label>
          <select
            id="fee-structure-grade"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('gradeId')}
          >
            <option value="">Any grade</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Description" error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  );
}
