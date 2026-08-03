import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { classService } from '@/features/academic/services/classService';
import { classSchema, classDefaultValues, type ClassFormValues } from '@/features/academic/schemas/classSchema';
import type { Class, Grade } from '@/features/academic/types/academic.types';

export interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  grades: Grade[];
  classItem?: Class | null;
  onSaved: () => void;
}

export function ClassFormModal({ isOpen, onClose, schoolId, grades, classItem, onSaved }: ClassFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(classItem);
  const activeGrades = useMemo(
    () => grades.filter((grade) => grade.active || grade.id === classItem?.gradeId),
    [grades, classItem],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({ resolver: zodResolver(classSchema), defaultValues: classDefaultValues });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      classItem
        ? { gradeId: classItem.gradeId, name: classItem.name, capacity: classItem.capacity }
        : { ...classDefaultValues, gradeId: activeGrades[0]?.id ?? '' },
    );
    setSubmitError(null);
  }, [isOpen, classItem, reset, activeGrades]);

  const onValid = async (values: ClassFormValues) => {
    setSubmitError(null);
    try {
      if (classItem) {
        await classService.updateClass(classItem.id, values);
      } else {
        await classService.createClass(schoolId, values);
      }
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save class.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit class' : 'Add class'}
      footer={
        <Button type="submit" form="class-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="class-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="class-grade" className="mb-1.5 block text-sm font-medium text-content-primary">
            Grade <span className="text-danger-600" aria-hidden="true">*</span>
          </label>
          <select
            id="class-grade"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('gradeId')}
          >
            {activeGrades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
          {errors.gradeId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.gradeId.message}
            </p>
          )}
        </div>

        <TextField label="Name" required placeholder="Grade 8A" error={errors.name?.message} {...register('name')} />
        <TextField label="Capacity" type="number" required error={errors.capacity?.message} {...register('capacity')} />
      </form>
    </Modal>
  );
}
