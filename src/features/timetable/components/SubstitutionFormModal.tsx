import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { substitutionService } from '@/features/timetable/services/substitutionService';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { buildSubstitutionSchema, substitutionDefaultValues, type SubstitutionFormValues } from '@/features/timetable/schemas/substitutionSchema';
import { DAY_LABELS } from '@/features/timetable/types/timetable.types';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';
import type { Class, Subject } from '@/features/academic/types/academic.types';

export interface SubstitutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  entry: TimetableEntry | null;
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  onSaved: () => void;
}

export function SubstitutionFormModal({ isOpen, onClose, schoolId, entry, classesById, subjectsById, onSaved }: SubstitutionFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<TeacherCandidate | null>(null);

  const schema = useMemo(() => buildSubstitutionSchema(entry?.dayOfWeek ?? 'monday'), [entry?.dayOfWeek]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubstitutionFormValues>({ resolver: zodResolver(schema), defaultValues: substitutionDefaultValues });

  const substituteTeacherProfileId = watch('substituteTeacherProfileId');

  useEffect(() => {
    if (!isOpen) return;
    reset(substitutionDefaultValues);
    setSelectedCandidate(null);
    setSearch('');
    setSubmitError(null);
  }, [isOpen, entry, reset]);

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

  if (!entry) return null;

  const onValid = async (values: SubstitutionFormValues) => {
    setSubmitError(null);
    try {
      await substitutionService.createSubstitution(schoolId, {
        timetableEntryId: entry.id,
        substituteDate: values.substituteDate,
        substituteTeacherProfileId: values.substituteTeacherProfileId,
        reason: values.reason?.trim() || null,
      });
      onSaved();
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to assign a substitute teacher.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign substitute teacher"
      footer={
        <Button type="submit" form="substitution-form" isLoading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Assign substitute'}
        </Button>
      }
    >
      <form noValidate id="substitution-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <p className="text-sm text-content-secondary">
          {subjectsById[entry.subjectId]?.name ?? 'Subject'} · {classesById[entry.classId]?.name ?? 'Class'} · every{' '}
          {DAY_LABELS[entry.dayOfWeek]} {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
        </p>

        <TextField
          label="Substitute date"
          type="date"
          required
          error={errors.substituteDate?.message}
          {...register('substituteDate')}
        />

        <div>
          <TextField
            label="Search substitute teacher"
            placeholder="Search by name or email…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {selectedCandidate && !search && (
            <p className="mt-1.5 text-xs text-content-tertiary">
              Selected: {selectedCandidate.firstName} {selectedCandidate.lastName}
            </p>
          )}
          <div className="mt-2 flex flex-col gap-1">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => {
                  setValue('substituteTeacherProfileId', candidate.id, { shouldValidate: true });
                  setSelectedCandidate(candidate);
                }}
                className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm ${
                  substituteTeacherProfileId === candidate.id
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
          {errors.substituteTeacherProfileId && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
              {errors.substituteTeacherProfileId.message}
            </p>
          )}
        </div>

        <TextField label="Reason" placeholder="e.g. Sick leave" error={errors.reason?.message} {...register('reason')} />
      </form>
    </Modal>
  );
}
