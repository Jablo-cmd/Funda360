import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { academicYearService } from '@/features/academic/services/academicYearService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  academicYearSchema,
  academicYearDefaultValues,
  type AcademicYearFormValues,
} from '@/features/academic/schemas/academicYearSchema';
import type { AcademicYear } from '@/features/academic/types/academic.types';

export interface AcademicYearFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  /** Present in edit mode; omitted/null for create. */
  year?: AcademicYear | null;
  onSaved: () => void;
}

export function AcademicYearFormModal({ isOpen, onClose, schoolId, year, onSaved }: AcademicYearFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(year);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AcademicYearFormValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: academicYearDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      year
        ? { name: year.name, startDate: year.startDate, endDate: year.endDate }
        : academicYearDefaultValues,
    );
    setSubmitError(null);
  }, [isOpen, year, reset]);

  const onValid = async (values: AcademicYearFormValues) => {
    setSubmitError(null);
    try {
      if (year) {
        await academicYearService.updateAcademicYear(year.id, values);
      } else {
        await academicYearService.createAcademicYear(schoolId, values);
      }
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save academic year.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit academic year' : 'Add academic year'}
      footer={
        <Button type="submit" form="academic-year-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="academic-year-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <TextField label="Name" required error={errors.name?.message} {...register('name')} />
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
