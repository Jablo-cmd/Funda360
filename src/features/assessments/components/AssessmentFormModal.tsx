import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { assessmentService } from '@/features/assessments/services/assessmentService';
import { assessmentSchema, assessmentDefaultValues, type AssessmentFormValues } from '@/features/assessments/schemas/assessmentSchema';
import { ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS } from '@/features/assessments/types/assessment.types';
import type { Assessment } from '@/features/assessments/types/assessment.types';
import type { AcademicYear, Term, Class, Subject } from '@/features/academic/types/academic.types';
import type { ClassTeacherAssignment } from '@/features/teaching/types/teaching.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface AssessmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYears: AcademicYear[];
  terms: Term[];
  classes: Class[];
  subjects: Subject[];
  /** All classes the caller is permitted to create assessments for — already the class-scoped list (own assigned classes for a teacher, every active class for academic.manage holders). */
  availableClasses: Class[];
  /** The caller's own active teaching assignments, used to narrow the Subject list to what they actually teach in the selected class — empty for academic.manage holders, who see every subject. */
  myAssignments: ClassTeacherAssignment[];
  canManageAny: boolean;
  initialClassId?: string;
  onSaved: (assessment: Assessment) => void;
}

export function AssessmentFormModal({
  isOpen,
  onClose,
  schoolId,
  academicYears,
  terms,
  subjects,
  availableClasses,
  myAssignments,
  canManageAny,
  initialClassId,
  onSaved,
}: AssessmentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: assessmentDefaultValues,
  });

  const currentYear = academicYears.find((year) => year.isActive) ?? academicYears[0];
  const academicYearId = watch('academicYearId');
  const classId = watch('classId');
  const activeSubjects = subjects.filter((subject) => subject.active);
  const termsForYear = terms.filter((term) => term.academicYearId === academicYearId && term.active);

  useEffect(() => {
    if (!isOpen) return;
    reset({
      ...assessmentDefaultValues,
      academicYearId: currentYear?.id ?? '',
      classId: initialClassId ?? '',
    });
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset]);

  const availableSubjects = useMemo(() => {
    if (canManageAny || !classId) return activeSubjects;

    const assignmentsForClass = myAssignments.filter((a) => a.classId === classId && a.active);
    const isClassTeacher = assignmentsForClass.some((a) => a.subjectId === null);
    if (isClassTeacher) return activeSubjects;

    const subjectIds = new Set(assignmentsForClass.map((a) => a.subjectId).filter((id): id is string => id !== null));
    return activeSubjects.filter((subject) => subjectIds.has(subject.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageAny, classId, myAssignments, activeSubjects.length]);

  const onValid = async (values: AssessmentFormValues) => {
    setSubmitError(null);
    try {
      const saved = await assessmentService.createAssessment(schoolId, values);
      onSaved(saved);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to create assessment.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create assessment"
      footer={
        <Button type="submit" form="assessment-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create assessment'}
        </Button>
      }
    >
      <form noValidate id="assessment-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <TextField
          label="Title"
          placeholder="e.g. Test 1"
          required
          error={errors.title?.message}
          {...register('title')}
        />

        <div>
          <label htmlFor="assessment-class" className="mb-1.5 block text-sm font-medium text-content-primary">
            Class
          </label>
          <select
            id="assessment-class"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('classId')}
          >
            <option value="">Select a class…</option>
            {availableClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          {errors.classId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.classId.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="assessment-subject" className="mb-1.5 block text-sm font-medium text-content-primary">
            Subject
          </label>
          <select
            id="assessment-subject"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('subjectId')}
          >
            <option value="">Select a subject…</option>
            {availableSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          {errors.subjectId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.subjectId.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="assessment-year" className="mb-1.5 block text-sm font-medium text-content-primary">
              Academic year
            </label>
            <select
              id="assessment-year"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('academicYearId')}
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assessment-term" className="mb-1.5 block text-sm font-medium text-content-primary">
              Term
            </label>
            <select
              id="assessment-term"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('termId')}
            >
              <option value="">Select a term…</option>
              {termsForYear.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
            {errors.termId && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                {errors.termId.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="assessment-type" className="mb-1.5 block text-sm font-medium text-content-primary">
              Type
            </label>
            <select
              id="assessment-type"
              className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('assessmentType')}
            >
              {ASSESSMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSESSMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <TextField
            label="Maximum mark"
            type="number"
            min={1}
            step={1}
            required
            error={errors.maxMark?.message}
            {...register('maxMark')}
          />
        </div>

        <TextField
          label="Date"
          type="date"
          required
          error={errors.assessmentDate?.message}
          {...register('assessmentDate')}
        />
      </form>
    </Modal>
  );
}
