import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { enrollmentService } from '@/features/learners/services/enrollmentService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  enrollmentSchema,
  enrollmentDefaultValues,
  type EnrollmentFormValues,
} from '@/features/learners/schemas/enrollmentSchema';
import type { LearnerEnrollment } from '@/features/learners/types/learner.types';
import type { AcademicYear, Grade, Class } from '@/features/academic/types/academic.types';

export interface EnrollmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  learnerId: string;
  academicYears: AcademicYear[];
  grades: Grade[];
  classes: Class[];
  onSaved: (enrollment: LearnerEnrollment) => void;
}

export function EnrollmentFormModal({
  isOpen,
  onClose,
  schoolId,
  learnerId,
  academicYears,
  grades,
  classes,
  onSaved,
}: EnrollmentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentYear = academicYears.find((year) => year.isActive) ?? academicYears[0];
  const activeGrades = useMemo(() => grades.filter((grade) => grade.active), [grades]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: enrollmentDefaultValues,
  });

  const selectedGradeId = watch('gradeId');
  const classesForGrade = useMemo(
    () => classes.filter((cls) => cls.active && cls.gradeId === selectedGradeId),
    [classes, selectedGradeId],
  );

  useEffect(() => {
    if (!isOpen) return;
    reset({
      ...enrollmentDefaultValues,
      academicYearId: currentYear?.id ?? '',
      gradeId: activeGrades[0]?.id ?? '',
    });
    setSubmitError(null);
  }, [isOpen, currentYear, activeGrades, reset]);

  const onValid = async (values: EnrollmentFormValues) => {
    setSubmitError(null);
    try {
      const saved = await enrollmentService.createEnrollment(schoolId, learnerId, {
        academicYearId: values.academicYearId,
        gradeId: values.gradeId,
        classId: values.classId?.trim() || null,
        house: values.house?.trim() || null,
        stream: values.stream?.trim() || null,
        enrollmentDate: values.enrollmentDate,
      });
      onSaved(saved);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save enrollment.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add enrollment"
      footer={
        <Button type="submit" form="enrollment-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form noValidate id="enrollment-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="enrollment-year" className="mb-1.5 block text-sm font-medium text-content-primary">
            Academic year <span className="text-danger-600" aria-hidden="true">*</span>
          </label>
          <select
            id="enrollment-year"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('academicYearId')}
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
          {errors.academicYearId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.academicYearId.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="enrollment-grade" className="mb-1.5 block text-sm font-medium text-content-primary">
            Grade <span className="text-danger-600" aria-hidden="true">*</span>
          </label>
          <select
            id="enrollment-grade"
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

        <div>
          <label htmlFor="enrollment-class" className="mb-1.5 block text-sm font-medium text-content-primary">
            Class
          </label>
          <select
            id="enrollment-class"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('classId')}
          >
            <option value="">Unassigned</option>
            {classesForGrade.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <TextField
          label="Enrollment date"
          type="date"
          required
          error={errors.enrollmentDate?.message}
          {...register('enrollmentDate')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="House" error={errors.house?.message} {...register('house')} />
          <TextField label="Stream" error={errors.stream?.message} {...register('stream')} />
        </div>
      </form>
    </Modal>
  );
}
