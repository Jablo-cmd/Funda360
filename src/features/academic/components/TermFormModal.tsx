import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { termService } from '@/features/academic/services/termService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { termSchema, termDefaultValues, type TermFormValues } from '@/features/academic/schemas/termSchema';
import type { Term } from '@/features/academic/types/academic.types';

export interface TermFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYearId: string;
  term?: Term | null;
  onSaved: () => void;
}

export function TermFormModal({ isOpen, onClose, schoolId, academicYearId, term, onSaved }: TermFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(term);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TermFormValues>({ resolver: zodResolver(termSchema), defaultValues: termDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      term
        ? { name: term.name, sequence: term.sequence, startDate: term.startDate, endDate: term.endDate }
        : termDefaultValues,
    );
    setSubmitError(null);
  }, [isOpen, term, reset]);

  const onValid = async (values: TermFormValues) => {
    setSubmitError(null);
    try {
      if (term) {
        await termService.updateTerm(term.id, values);
      } else {
        await termService.createTerm(schoolId, { ...values, academicYearId });
      }
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save term.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit term' : 'Add term'}
      footer={
        <Button type="submit" form="term-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="term-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Name" required placeholder="Term 1" error={errors.name?.message} {...register('name')} />
          <TextField label="Sequence" type="number" required error={errors.sequence?.message} {...register('sequence')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Start date"
            type="date"
            required
            error={errors.startDate?.message}
            {...register('startDate')}
          />
          <TextField
            label="End date"
            type="date"
            required
            error={errors.endDate?.message}
            {...register('endDate')}
          />
        </div>
      </form>
    </Modal>
  );
}
