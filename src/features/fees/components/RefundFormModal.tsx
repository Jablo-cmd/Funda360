import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { feeService } from '@/features/fees/services/feeService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { refundSchema, refundDefaultValues, type RefundFormValues } from '@/features/fees/schemas/refundSchema';
import type { LearnerFeePayment } from '@/features/fees/types/fee.types';

export interface RefundFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  /** The specific payment being refunded — pre-selected, not switchable, so the refund is always initiated from the payment row it belongs to. */
  payment: LearnerFeePayment | null;
  onSaved: () => void;
}

const METHOD_LABELS: Record<RefundFormValues['method'], string> = {
  cash: 'Cash',
  eft: 'EFT',
  card: 'Card',
  debit_order: 'Debit order',
  cheque: 'Cheque',
  other: 'Other',
};

const STATUS_LABELS: Record<RefundFormValues['status'], string> = {
  pending: 'Pending (not yet paid out — does not affect balance yet)',
  completed: 'Completed (money already returned)',
  rejected: 'Rejected',
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RefundFormModal({ isOpen, onClose, schoolId, learnerId, academicYearId, payment, onSaved }: RefundFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RefundFormValues>({ resolver: zodResolver(refundSchema), defaultValues: refundDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset({ ...refundDefaultValues, paymentId: payment?.id ?? '', refundDate: todayIsoDate(), amount: payment?.amount ?? 0 });
    setSubmitError(null);
  }, [isOpen, payment, reset]);

  const onValid = async (values: RefundFormValues) => {
    setSubmitError(null);
    try {
      await feeService.createRefund(schoolId, learnerId, {
        academicYearId,
        paymentId: values.paymentId,
        amount: values.amount,
        refundDate: values.refundDate,
        method: values.method,
        reference: values.reference?.trim() || null,
        reason: values.reason,
        status: values.status,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record refund. The amount may exceed what remains refundable for this payment.'));
    }
  };

  if (!payment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Refund payment"
      footer={
        <Button type="submit" form="fee-refund-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Record refund'}
        </Button>
      }
    >
      <form noValidate id="fee-refund-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <p className="text-sm text-content-secondary">
          Refunding the {payment.method.replace('_', ' ')} payment of{' '}
          <span className="font-mono font-medium text-content-primary">
            {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(payment.amount)}
          </span>{' '}
          received {new Date(`${payment.paymentDate}T00:00:00`).toLocaleDateString('en-ZA')}.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Refund amount"
            type="number"
            step="0.01"
            min={0.01}
            required
            error={errors.amount?.message}
            {...register('amount')}
          />
          <TextField label="Refund date" type="date" required error={errors.refundDate?.message} {...register('refundDate')} />
        </div>

        <div>
          <label htmlFor="fee-refund-method" className="mb-1.5 block text-sm font-medium text-content-primary">
            Method
          </label>
          <select
            id="fee-refund-method"
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

        <div>
          <label htmlFor="fee-refund-status" className="mb-1.5 block text-sm font-medium text-content-primary">
            Status
          </label>
          <select
            id="fee-refund-status"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('status')}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Reference" placeholder="Bank reference" error={errors.reference?.message} {...register('reference')} />
        <TextField label="Reason" required placeholder="e.g. Overpayment, withdrawal refund" error={errors.reason?.message} {...register('reason')} />
      </form>
    </Modal>
  );
}
