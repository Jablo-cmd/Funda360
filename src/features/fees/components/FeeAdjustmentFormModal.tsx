import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { feeService } from '@/features/fees/services/feeService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { adjustmentSchema, adjustmentDefaultValues, type AdjustmentFormValues } from '@/features/fees/schemas/adjustmentSchema';
import type { LearnerFeeCharge } from '@/features/fees/types/fee.types';

export interface FeeAdjustmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  charges: LearnerFeeCharge[];
  onSaved: () => void;
}

const TYPE_LABELS: Record<AdjustmentFormValues['adjustmentType'], string> = {
  discount: 'Discount',
  bursary: 'Bursary',
  scholarship: 'Scholarship',
  waiver: 'Waiver',
};

const METHOD_LABELS: Record<AdjustmentFormValues['method'], string> = {
  fixed_amount: 'Fixed amount (Rand)',
  percentage: 'Percentage of a charge',
};

export function FeeAdjustmentFormModal({
  isOpen,
  onClose,
  schoolId,
  learnerId,
  academicYearId,
  charges,
  onSaved,
}: FeeAdjustmentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormValues>({ resolver: zodResolver(adjustmentSchema), defaultValues: adjustmentDefaultValues });

  const method = watch('method');

  useEffect(() => {
    if (!isOpen) return;
    reset(adjustmentDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: AdjustmentFormValues) => {
    setSubmitError(null);
    try {
      await feeService.createAdjustment(schoolId, learnerId, {
        academicYearId,
        chargeId: values.chargeId || null,
        adjustmentType: values.adjustmentType,
        method: values.method,
        percentage: values.method === 'percentage' ? values.percentage ?? null : null,
        amount: values.amount,
        reason: values.reason,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to add adjustment.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add discount / bursary / scholarship"
      footer={
        <Button type="submit" form="fee-adjustment-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Add adjustment'}
        </Button>
      }
    >
      <form noValidate id="fee-adjustment-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="fee-adjustment-type" className="mb-1.5 block text-sm font-medium text-content-primary">
              Type
            </label>
            <select
              id="fee-adjustment-type"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('adjustmentType')}
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fee-adjustment-method" className="mb-1.5 block text-sm font-medium text-content-primary">
              How is it calculated?
            </label>
            <select
              id="fee-adjustment-method"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('method')}
            >
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {method === 'percentage' && (
          <TextField
            label="Percentage"
            type="number"
            step="0.01"
            min={0.01}
            max={100}
            required
            error={errors.percentage?.message}
            {...register('percentage')}
          />
        )}

        <TextField
          label="Amount (Rand removed from the balance)"
          type="number"
          step="0.01"
          min={0.01}
          required
          error={errors.amount?.message}
          {...register('amount')}
        />

        <div>
          <label htmlFor="fee-adjustment-charge" className="mb-1.5 block text-sm font-medium text-content-primary">
            Apply to a specific charge (optional)
          </label>
          <select
            id="fee-adjustment-charge"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('chargeId')}
          >
            <option value="">General account adjustment</option>
            {charges.map((charge) => (
              <option key={charge.id} value={charge.id}>
                {charge.description}
              </option>
            ))}
          </select>
        </div>

        <TextField
          label="Reason"
          required
          placeholder="e.g. Sibling discount, approved bursary"
          error={errors.reason?.message}
          {...register('reason')}
        />
      </form>
    </Modal>
  );
}
