import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { transferService } from '@/features/learners/services/transferService';
import { learnerService } from '@/features/learners/services/learnerService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { transferSchema, transferDefaultValues, type TransferFormValues } from '@/features/learners/schemas/transferSchema';
import type { Learner } from '@/features/learners/types/learner.types';

export interface TransferFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learner: Learner;
  onSaved: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Records a transfer's details (direction, other school, date, reason) —
 * separately from, and optionally alongside, the learner's own status
 * change. For an outgoing transfer this offers a one-click "also mark this
 * learner as Transferred" checkbox that calls the existing
 * change_learner_status() RPC right after (already a valid transition from
 * 'active', per learners_validate_status_transition()) — but leaves it
 * unchecked-able for the historical-backfill case (recording a transfer
 * that already happened, whose status change was handled separately).
 */
export function TransferFormModal({ isOpen, onClose, schoolId, learner, onSaved }: TransferFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alsoMarkTransferred, setAlsoMarkTransferred] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormValues>({ resolver: zodResolver(transferSchema), defaultValues: transferDefaultValues });

  const direction = watch('direction');

  useEffect(() => {
    if (!isOpen) return;
    reset({ ...transferDefaultValues, transferDate: todayIsoDate() });
    setAlsoMarkTransferred(true);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: TransferFormValues) => {
    setSubmitError(null);
    try {
      await transferService.createTransfer(schoolId, learner.id, {
        direction: values.direction,
        otherSchoolName: values.otherSchoolName,
        otherSchoolContact: values.otherSchoolContact?.trim() || null,
        transferDate: values.transferDate,
        reason: values.reason?.trim() || null,
        notes: values.notes?.trim() || null,
      });
      if (values.direction === 'outgoing' && alsoMarkTransferred) {
        await learnerService.changeStatus(learner.id, 'transferred', values.reason?.trim() || null);
      }
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record the transfer.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record transfer"
      footer={
        <Button type="submit" form="learner-transfer-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Record transfer'}
        </Button>
      }
    >
      <form noValidate id="learner-transfer-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="transfer-direction" className="mb-1.5 block text-sm font-medium text-content-primary">
            Direction
          </label>
          <select
            id="transfer-direction"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('direction')}
          >
            <option value="outgoing">Outgoing — leaving for another school</option>
            <option value="incoming">Incoming — arrived from a prior school</option>
          </select>
        </div>

        <TextField
          label="Other school's name"
          required
          error={errors.otherSchoolName?.message}
          {...register('otherSchoolName')}
        />
        <TextField
          label="Other school's contact"
          placeholder="Email or phone"
          error={errors.otherSchoolContact?.message}
          {...register('otherSchoolContact')}
        />
        <TextField label="Transfer date" type="date" required error={errors.transferDate?.message} {...register('transferDate')} />
        <TextField label="Reason" error={errors.reason?.message} {...register('reason')} />
        <TextField label="Notes" error={errors.notes?.message} {...register('notes')} />

        {direction === 'outgoing' && (
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={alsoMarkTransferred}
              onChange={(event) => setAlsoMarkTransferred(event.target.checked)}
              className="focus-ring h-4 w-4 rounded border-border-strong"
            />
            Also mark this learner's status as Transferred
          </label>
        )}
      </form>
    </Modal>
  );
}
