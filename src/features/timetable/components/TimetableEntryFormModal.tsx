import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { timetableService } from '@/features/timetable/services/timetableService';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import {
  timetableEntrySchema,
  timetableEntryDefaultValues,
  type TimetableEntryFormValues,
} from '@/features/timetable/schemas/timetableEntrySchema';
import { DAYS_OF_WEEK, DAY_LABELS } from '@/features/timetable/types/timetable.types';
import type { TimetableEntry } from '@/features/timetable/types/timetable.types';
import type { Class, Subject, AcademicYear, Term } from '@/features/academic/types/academic.types';

export interface TimetableEntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  academicYears: AcademicYear[];
  terms: Term[];
  classes: Class[];
  subjects: Subject[];
  entry?: TimetableEntry | null;
  onSaved: (entry: TimetableEntry, candidate?: TeacherCandidate) => void;
  onArchive?: (entryId: string) => void | Promise<void>;
}

export function TimetableEntryFormModal({
  isOpen,
  onClose,
  schoolId,
  academicYears,
  terms,
  classes,
  subjects,
  entry,
  onSaved,
  onArchive,
}: TimetableEntryFormModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<TeacherCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<TeacherCandidate | null>(null);
  const isEditing = Boolean(entry);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TimetableEntryFormValues>({
    resolver: zodResolver(timetableEntrySchema),
    defaultValues: timetableEntryDefaultValues,
  });

  const teacherProfileId = watch('teacherProfileId');
  const currentYear = academicYears.find((year) => year.isActive) ?? academicYears[0];
  const activeClasses = classes.filter((cls) => cls.active);
  const activeSubjects = subjects.filter((subject) => subject.active);
  // `terms` is already scoped by the caller to whichever academic year the
  // Timetable page currently has selected (useTerms only ever fetches one
  // year at a time) — the academic-year <select> below still lets a manager
  // choose a different year for this one entry, but the term list will
  // then reflect the page's selected year, not necessarily this field's
  // value. Accepted V1 simplification: term is optional (defaults to
  // "whole year"), so a mismatched list only limits an edge case, never
  // produces wrong data.
  const activeTerms = terms.filter((term) => term.active);

  useEffect(() => {
    if (!isOpen) return;
    reset(
      entry
        ? {
            academicYearId: entry.academicYearId,
            termId: entry.termId ?? '',
            classId: entry.classId,
            subjectId: entry.subjectId,
            teacherProfileId: entry.teacherProfileId,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime.slice(0, 5),
            endTime: entry.endTime.slice(0, 5),
            room: entry.room ?? '',
          }
        : { ...timetableEntryDefaultValues, academicYearId: currentYear?.id ?? '' },
    );
    setSelectedCandidate(null);
    setSearch('');
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!isOpen || !entry) return;
    void teachingAssignmentService.getTeacherCandidatesByIds([entry.teacherProfileId]).then((results) => {
      if (results[0]) setSelectedCandidate(results[0]);
    });
  }, [isOpen, entry]);

  const onValid = async (values: TimetableEntryFormValues) => {
    setSubmitError(null);
    try {
      const input = {
        academicYearId: values.academicYearId,
        termId: values.termId?.trim() || null,
        classId: values.classId,
        subjectId: values.subjectId,
        teacherProfileId: values.teacherProfileId,
        dayOfWeek: values.dayOfWeek,
        startTime: values.startTime,
        endTime: values.endTime,
        room: values.room?.trim() || null,
      };
      const saved = entry
        ? await timetableService.updateEntry(entry.id, {
            academic_year_id: input.academicYearId,
            term_id: input.termId,
            class_id: input.classId,
            subject_id: input.subjectId,
            teacher_profile_id: input.teacherProfileId,
            day_of_week: input.dayOfWeek,
            start_time: input.startTime,
            end_time: input.endTime,
            room: input.room,
          })
        : await timetableService.createEntry(schoolId, input);
      onSaved(saved, selectedCandidate ?? undefined);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to save this lesson.'));
    }
  };

  const handleArchiveClick = async () => {
    if (!entry || !onArchive) return;
    setSubmitError(null);
    setIsArchiving(true);
    try {
      await onArchive(entry.id);
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to archive this lesson.'));
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit lesson' : 'Add lesson'}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {isEditing && onArchive ? (
            <button
              type="button"
              onClick={() => void handleArchiveClick()}
              disabled={isArchiving}
              className="focus-ring rounded-md px-2 py-1 text-sm font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50"
            >
              {isArchiving ? 'Archiving…' : 'Archive this lesson'}
            </button>
          ) : (
            <span />
          )}
          <Button type="submit" form="timetable-entry-form" isLoading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <form noValidate id="timetable-entry-form" onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        {submitError && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {submitError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="entry-year" className="mb-1.5 block text-sm font-medium text-content-primary">
              Academic year
            </label>
            <select
              id="entry-year"
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
            <label htmlFor="entry-term" className="mb-1.5 block text-sm font-medium text-content-primary">
              Term
            </label>
            <select
              id="entry-term"
              className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
              {...register('termId')}
            >
              <option value="">Whole year</option>
              {activeTerms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="entry-class" className="mb-1.5 block text-sm font-medium text-content-primary">
            Class
          </label>
          <select
            id="entry-class"
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
          <label htmlFor="entry-subject" className="mb-1.5 block text-sm font-medium text-content-primary">
            Subject
          </label>
          <select
            id="entry-subject"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('subjectId')}
          >
            <option value="">Select a subject…</option>
            {activeSubjects.map((subject) => (
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

        <div>
          <TextField
            label="Search teacher"
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
          <label htmlFor="entry-day" className="mb-1.5 block text-sm font-medium text-content-primary">
            Day
          </label>
          <select
            id="entry-day"
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
            {...register('dayOfWeek')}
          >
            {DAYS_OF_WEEK.map((day) => (
              <option key={day} value={day}>
                {DAY_LABELS[day]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Start time" type="time" required error={errors.startTime?.message} {...register('startTime')} />
          <TextField label="End time" type="time" required error={errors.endTime?.message} {...register('endTime')} />
        </div>

        <TextField label="Room" placeholder="e.g. Room 4, Science Lab" error={errors.room?.message} {...register('room')} />
      </form>
    </Modal>
  );
}
