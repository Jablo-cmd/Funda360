import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { feeService } from '@/features/fees/services/feeService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { paymentSchema, paymentDefaultValues, type PaymentFormValues } from '@/features/fees/schemas/paymentSchema';

export interface RecordPaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  onSaved: () => void;
}

const METHOD_LABELS: Record<PaymentFormValues['method'], string> = {
  cash: 'Cash',
  eft: 'EFT',
  card: 'Card',
  debit_order: 'Debit order',
  cheque: 'Cheque',
  other: 'Other',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentFormModal({ isOpen, onClose, schoolId, learnerId, academicYearId, onSaved }: RecordPaymentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({ resolver: zodResolver(paymentSchema), defaultValues: paymentDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset({ ...paymentDefaultValues, paymentDate: todayIsoDate() });
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: PaymentFormValues) => {
    setSubmitError(null);
    try {
      await feeService.createPayment(schoolId, learnerId, {
        academicYearId,
        amount: values.amount,
        paymentDate: values.paymentDate,
        method: values.method,
        reference: values.reference?.trim() || null,
        notes: values.notes?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record payment.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record payment"
      footer={
        <Button type="submit" form="fee-payment-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Record payment'}
        </Button>
      }
    >
      <form noValidate id="fee-payment-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Amount"
            type="number"
            step="0.01"
            min={0.01}
            required
            error={errors.amount?.message}
            {...register('amount')}
          />
          <TextField
            label="Payment date"
            type="date"
            required
            error={errors.paymentDate?.message}
            {...register('paymentDate')}
          />
        </div>

        <div>
          <label htmlFor="fee-payment-method" className="mb-1.5 block text-sm font-medium text-content-primary">
            Method
          </label>
          <select
            id="fee-payment-method"
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

        <TextField label="Reference" placeholder="Bank reference / receipt no." error={errors.reference?.message} {...register('reference')} />
        <TextField label="Notes" error={errors.notes?.message} {...register('notes')} />
      </form>
    </Modal>
  );
}
