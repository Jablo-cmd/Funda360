import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { behaviourService } from '@/features/behaviour/services/behaviourService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  behaviourIncidentSchema,
  behaviourIncidentDefaultValues,
  type BehaviourIncidentFormValues,
} from '@/features/behaviour/schemas/behaviourIncidentSchema';

export interface BehaviourIncidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  onSaved: () => void;
}

export function BehaviourIncidentFormModal({
  isOpen,
  onClose,
  schoolId,
  learnerId,
  academicYearId,
  onSaved,
}: BehaviourIncidentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BehaviourIncidentFormValues>({
    resolver: zodResolver(behaviourIncidentSchema),
    defaultValues: behaviourIncidentDefaultValues,
  });

  const incidentType = watch('incidentType');

  useEffect(() => {
    if (!isOpen) return;
    reset(behaviourIncidentDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: BehaviourIncidentFormValues) => {
    setSubmitError(null);
    try {
      await behaviourService.createIncident(schoolId, learnerId, {
        academicYearId,
        incidentType: values.incidentType,
        severity: values.incidentType === 'negative' ? values.severity || null : null,
        category: values.category?.trim() || null,
        occurredAt: values.occurredAt,
        description: values.description,
        actionTaken: values.actionTaken?.trim() || null,
        outcome: values.outcome?.trim() || null,
        followUpRequired: values.followUpRequired ?? false,
        followUpNotes: values.followUpNotes?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record behaviour incident.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record behaviour incident"
      footer={
        <Button type="submit" form="behaviour-incident-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Record incident'}
        </Button>
      }
    >
      <form noValidate id="behaviour-incident-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="behaviour-type" className="mb-1.5 block text-sm font-medium text-content-primary">
              Type
            </label>
            <select
              id="behaviour-type"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('incidentType')}
            >
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          {incidentType === 'negative' && (
            <div>
              <label htmlFor="behaviour-severity" className="mb-1.5 block text-sm font-medium text-content-primary">
                Severity
              </label>
              <select
                id="behaviour-severity"
                className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
                {...register('severity')}
              >
                <option value="">Not specified</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}
        </div>

        <TextField label="Category" placeholder="e.g. Disruption, Achievement" error={errors.category?.message} {...register('category')} />
        <TextField
          label="Date and time"
          type="datetime-local"
          required
          error={errors.occurredAt?.message}
          {...register('occurredAt')}
        />
        <TextField label="Description" required error={errors.description?.message} {...register('description')} />
        <TextField label="Action taken" error={errors.actionTaken?.message} {...register('actionTaken')} />
        <TextField label="Outcome" error={errors.outcome?.message} {...register('outcome')} />
        <Checkbox label="Follow-up required" {...register('followUpRequired')} />
        <TextField label="Follow-up notes" error={errors.followUpNotes?.message} {...register('followUpNotes')} />
      </form>
    </Modal>
  );
}
