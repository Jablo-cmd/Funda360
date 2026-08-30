import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { safeguardingService } from '@/features/safeguarding/services/safeguardingService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  safeguardingConcernSchema,
  safeguardingConcernDefaultValues,
  type SafeguardingConcernFormValues,
} from '@/features/safeguarding/schemas/safeguardingSchema';

export interface SafeguardingConcernFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  onSaved: () => void;
}

export function SafeguardingConcernFormModal({ isOpen, onClose, schoolId, learnerId, onSaved }: SafeguardingConcernFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SafeguardingConcernFormValues>({
    resolver: zodResolver(safeguardingConcernSchema),
    defaultValues: safeguardingConcernDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(safeguardingConcernDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: SafeguardingConcernFormValues) => {
    setSubmitError(null);
    try {
      await safeguardingService.createConcern(schoolId, learnerId, {
        category: values.category?.trim() || null,
        description: values.description,
        severity: values.severity,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record this concern.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record safeguarding concern"
      footer={
        <Button type="submit" form="safeguarding-concern-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Record concern'}
        </Button>
      }
    >
      <form noValidate id="safeguarding-concern-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <p className="rounded-lg border border-warning-500/30 bg-warning-50 px-3.5 py-2.5 text-xs text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
          Confidential. Visible only to the school owner and principal.
        </p>

        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <TextField label="Category (optional)" placeholder="e.g. Online safety, Neglect" error={errors.category?.message} {...register('category')} />

        <div>
          <label htmlFor="safeguarding-severity" className="mb-1.5 block text-sm font-medium text-content-primary">
            Severity
          </label>
          <select
            id="safeguarding-severity"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('severity')}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <TextField label="Description" required error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  );
}
