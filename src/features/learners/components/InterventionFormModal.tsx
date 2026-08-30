import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { interventionService } from '@/features/learners/services/interventionService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  interventionSchema,
  interventionDefaultValues,
  type InterventionFormValues,
} from '@/features/learners/schemas/interventionSchema';
import type { Subject } from '@/features/academic/types/academic.types';

export interface InterventionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  subjects: Subject[];
  onSaved: () => void;
}

export function InterventionFormModal({
  isOpen,
  onClose,
  schoolId,
  learnerId,
  academicYearId,
  subjects,
  onSaved,
}: InterventionFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InterventionFormValues>({ resolver: zodResolver(interventionSchema), defaultValues: interventionDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(interventionDefaultValues);
    setSubmitError(null);
  }, [isOpen, reset]);

  const onValid = async (values: InterventionFormValues) => {
    setSubmitError(null);
    try {
      await interventionService.createIntervention(schoolId, learnerId, {
        academicYearId,
        subjectId: values.subjectId || null,
        title: values.title,
        description: values.description?.trim() || null,
        targetDate: values.targetDate?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to record the intervention.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record intervention"
      footer={
        <Button type="submit" form="intervention-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Record intervention'}
        </Button>
      }
    >
      <form noValidate id="intervention-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <TextField label="Title" required placeholder="e.g. Extra Mathematics support" error={errors.title?.message} {...register('title')} />

        <div>
          <label htmlFor="intervention-subject" className="mb-1.5 block text-sm font-medium text-content-primary">
            Subject (optional)
          </label>
          <select
            id="intervention-subject"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('subjectId')}
          >
            <option value="">General / cross-subject</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <TextField label="Description" error={errors.description?.message} {...register('description')} />
        <TextField label="Target review date" type="date" error={errors.targetDate?.message} {...register('targetDate')} />
      </form>
    </Modal>
  );
}
