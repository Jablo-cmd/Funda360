import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  teachingAssignmentSchema,
  teachingAssignmentDefaultValues,
  type TeachingAssignmentFormValues,
} from '@/features/teaching/schemas/teachingAssignmentSchema';
import type { ClassTeacherAssignment } from '@/features/teaching/types/teaching.types';
import type { Class, Subject, AcademicYear } from '@/features/academic/types/academic.types';

export interface TeachingAssignmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYears: AcademicYear[];
  classes: Class[];
  subjects: Subject[];
  onSaved: (assignment: ClassTeacherAssignment, candidate?: TeacherCandidate) => void;
}

export function TeachingAssignmentFormModal({
  isOpen,
  onClose,
  schoolId,
  academicYears,
  classes,
  subjects,
  onSaved,
}: TeachingAssignmentFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<TeacherCandidate | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TeachingAssignmentFormValues>({
    resolver: zodResolver(teachingAssignmentSchema),
    defaultValues: teachingAssignmentDefaultValues,
  });

  const teacherProfileId = watch('teacherProfileId');
  const currentYear = academicYears.find((year) => year.isActive) ?? academicYears[0];
  const activeClasses = classes.filter((cls) => cls.active);
  const activeSubjects = subjects.filter((subject) => subject.active);

  useEffect(() => {
    if (!isOpen) return;
    reset({ ...teachingAssignmentDefaultValues, academicYearId: currentYear?.id ?? '' });
    setSelectedCandidate(null);
    setSearch('');
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void teachingAssignmentService.searchTeacherCandidates(schoolId, search).then((results) => {
      if (!cancelled) setCandidates(results);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, schoolId, search]);

  const onValid = async (values: TeachingAssignmentFormValues) => {
    setSubmitError(null);
    try {
      const saved = await teachingAssignmentService.createAssignment(schoolId, {
        academicYearId: values.academicYearId,
        classId: values.classId,
        subjectId: values.subjectId?.trim() || null,
        teacherProfileId: values.teacherProfileId,
      });
      onSaved(saved, selectedCandidate ?? undefined);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save teaching assignment.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add teaching assignment"
      footer={
        <Button type="submit" form="teaching-assignment-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <form
        noValidate
        id="teaching-assignment-form"
        onSubmit={handleSubmit(onValid)}
        className="flex flex-col gap-4"
      >
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div>
          <TextField
            label="Search teacher"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="mt-2 flex flex-col gap-1">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setValue('teacherProfileId', candidate.id, { shouldValidate: true });
                  setSelectedCandidate(candidate);
                }}
                className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm ${
                  teacherProfileId === candidate.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-border-strong bg-surface-raised hover:bg-surface-sunken'
                }`}
              >
                <span className="font-medium text-content-primary">
                  {candidate.firstName} {candidate.lastName}
                </span>{' '}
                <span className="text-content-tertiary">{candidate.email}</span>
              </button>
            ))}
          </div>
          {errors.teacherProfileId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.teacherProfileId.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="assignment-year" className="mb-1.5 block text-sm font-medium text-content-primary">
            Academic year
          </label>
          <select
            id="assignment-year"
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
          <label htmlFor="assignment-class" className="mb-1.5 block text-sm font-medium text-content-primary">
            Class
          </label>
          <select
            id="assignment-class"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('classId')}
          >
            <option value="">Select a class…</option>
            {activeClasses.map((cls) => (
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
          <label htmlFor="assignment-subject" className="mb-1.5 block text-sm font-medium text-content-primary">
            Subject
          </label>
          <select
            id="assignment-subject"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('subjectId')}
          >
            <option value="">Class teacher (whole class, no specific subject)</option>
            {activeSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
