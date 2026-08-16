import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { gradeService } from '@/features/academic/services/gradeService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { gradeSchema, gradeDefaultValues, type GradeFormValues } from '@/features/academic/schemas/gradeSchema';
import type { Grade } from '@/features/academic/types/academic.types';

export interface GradeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  grade?: Grade | null;
  onSaved: () => void;
}

export function GradeFormModal({ isOpen, onClose, schoolId, grade, onSaved }: GradeFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(grade);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeFormValues>({ resolver: zodResolver(gradeSchema), defaultValues: gradeDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      grade
        ? {
            name: grade.name,
            code: grade.code ?? '',
            description: grade.description ?? '',
            sortOrder: grade.sortOrder,
          }
        : gradeDefaultValues,
    );
    setSubmitError(null);
  }, [isOpen, grade, reset]);

  const onValid = async (values: GradeFormValues) => {
    setSubmitError(null);
    try {
      const payload = {
        name: values.name,
        code: values.code?.trim() || null,
        description: values.description?.trim() || null,
        sortOrder: values.sortOrder,
      };
      if (grade) {
        await gradeService.updateGrade(grade.id, payload);
      } else {
        await gradeService.createGrade(schoolId, payload);
      }
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save grade.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit grade' : 'Add grade'}
      footer={
        <Button type="submit" form="grade-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="grade-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <TextField label="Name" required placeholder="Grade 8" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Code" placeholder="G8" error={errors.code?.message} {...register('code')} />
          <TextField
            label="Sort order"
            type="number"
            error={errors.sortOrder?.message}
            {...register('sortOrder')}
          />
        </div>
        <TextField label="Description" error={errors.description?.message} {...register('description')} />
      </form>
    </Modal>
  );
}
