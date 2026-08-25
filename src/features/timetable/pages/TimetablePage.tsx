import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useTerms } from '@/features/academic/hooks/useTerms';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTimetableEntries } from '@/features/timetable/hooks/useTimetableEntries';
import { timetableService } from '@/features/timetable/services/timetableService';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import { TimetableFiltersBar } from '@/features/timetable/components/TimetableFiltersBar';
import type { TimetableViewMode } from '@/features/timetable/components/TimetableFiltersBar';
import { WeeklyTimetableGrid } from '@/features/timetable/components/WeeklyTimetableGrid';
import { ArchivedTimetableEntriesTable } from '@/features/timetable/components/ArchivedTimetableEntriesTable';
import { TimetableEntryFormModal } from '@/features/timetable/components/TimetableEntryFormModal';
import type { TimetableEntry, DayOfWeek } from '@/features/timetable/types/timetable.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function TimetablePage() {
  const { can } = usePermissions();
  const canManage = can('timetable.manage');
  const { school } = useSchool();
  const { academicYears, currentAcademicYear } = useAcademic();

  const [academicYearId, setAcademicYearId] = useState<string>('');
  useEffect(() => {
    if (!academicYearId && currentAcademicYear) setAcademicYearId(currentAcademicYear.id);
  }, [academicYearId, currentAcademicYear]);

  const { terms } = useTerms(academicYearId || undefined);
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { entries, isLoading, error, refetch } = useTimetableEntries(school?.id, academicYearId || undefined);

  const [viewMode, setViewMode] = useState<TimetableViewMode>('school');
  const [classId, setClassId] = useState('');
  const [teacherProfileId, setTeacherProfileId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek | ''>('');
  const [showArchived, setShowArchived] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [teachersById, setTeachersById] = useState<Record<string, TeacherCandidate>>({});

  const classesById = useMemo(() => Object.fromEntries(classes.map((cls) => [cls.id, cls])), [classes]);
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((subject) => [subject.id, subject])), [subjects]);

  const teacherProfileIds = useMemo(() => [...new Set(entries.map((entry) => entry.teacherProfileId))], [entries]);
  useEffect(() => {
    const missingIds = teacherProfileIds.filter((id) => !teachersById[id]);
    if (missingIds.length === 0) return;
    void teachingAssignmentService.getTeacherCandidatesByIds(missingIds).then((results) => {
      setTeachersById((prev) => {
        const next = { ...prev };
        for (const candidate of results) next[candidate.id] = candidate;
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherProfileIds]);

  const teachersInTimetable = useMemo(
    () => teacherProfileIds.map((id) => teachersById[id]).filter((t): t is TeacherCandidate => Boolean(t)),
    [teacherProfileIds, teachersById],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (viewMode === 'class' && classId && entry.classId !== classId) return false;
      if (viewMode === 'teacher' && teacherProfileId && entry.teacherProfileId !== teacherProfileId) return false;
      if (subjectId && entry.subjectId !== subjectId) return false;
      if (dayOfWeek && entry.dayOfWeek !== dayOfWeek) return false;
      return true;
    });
  }, [entries, viewMode, classId, teacherProfileId, subjectId, dayOfWeek]);

  const gridEntries = viewMode === 'class' && !classId ? [] : viewMode === 'teacher' && !teacherProfileId ? [] : filteredEntries;
  const archivedEntries = filteredEntries.filter((entry) => !entry.active);

  const handleArchive = async (entryId: string) => {
    setActionError(null);
    try {
      await timetableService.archiveEntry(entryId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to archive this lesson.'));
    }
  };

  const handleRestore = async (entryId: string) => {
    setActionError(null);
    try {
      await timetableService.restoreEntry(entryId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to restore this lesson.'));
    }
  };

  const openEdit = (entry: TimetableEntry) => {
    if (!canManage) return;
    setEditingEntry(entry);
    setIsFormOpen(true);
  };

  const openCreate = () => {
    setEditingEntry(null);
    setIsFormOpen(true);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Timetable"
        description="Weekly lesson schedule for classes and teachers."
        action={
          canManage &&
          school && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="button" onClick={openCreate} disabled={!academicYearId}>
                Add lesson
              </Button>
            </div>
          )
        }
      />

      {school && academicYears.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="timetable-year" className="text-sm font-medium text-content-secondary">
            Academic year
          </label>
          <select
            id="timetable-year"
            value={academicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
            className="focus-ring h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary sm:w-56"
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.isActive ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {school && (
        <TimetableFiltersBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          classes={classes.filter((cls) => cls.active)}
          classId={classId}
          onClassChange={setClassId}
          teachers={teachersInTimetable}
          teacherProfileId={teacherProfileId}
          onTeacherChange={setTeacherProfileId}
          subjects={subjects.filter((subject) => subject.active)}
          subjectId={subjectId}
          onSubjectChange={setSubjectId}
          dayOfWeek={dayOfWeek}
          onDayChange={setDayOfWeek}
          showArchived={showArchived}
          onShowArchivedChange={setShowArchived}
        />
      )}

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="the timetable" />
      ) : !academicYearId ? (
        <p className="text-sm text-content-tertiary">Add an academic year before creating a timetable.</p>
      ) : isLoading ? (
        <LoadingBlock label="Loading timetable…" />
      ) : viewMode === 'class' && !classId ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          Select a class to view its timetable.
        </p>
      ) : viewMode === 'teacher' && !teacherProfileId ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          Select a teacher to view their timetable.
        </p>
      ) : (
        <>
          <WeeklyTimetableGrid
            entries={gridEntries}
            classesById={classesById}
            subjectsById={subjectsById}
            teachersById={teachersById}
            showClassLabel={viewMode !== 'class'}
            showTeacherLabel={viewMode !== 'teacher'}
            canManage={canManage}
            onEdit={openEdit}
          />

          {showArchived && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-content-primary">Archived lessons</h3>
              <ArchivedTimetableEntriesTable
                entries={archivedEntries}
                classesById={classesById}
                subjectsById={subjectsById}
                teachersById={teachersById}
                canManage={canManage}
                onRestore={(entry) => void handleRestore(entry.id)}
              />
            </div>
          )}
        </>
      )}

      {school && academicYearId && (
        <TimetableEntryFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          academicYears={academicYears}
          terms={terms}
          classes={classes}
          subjects={subjects}
          entry={editingEntry}
          onSaved={(_, candidate) => {
            if (candidate) setTeachersById((prev) => ({ ...prev, [candidate.id]: candidate }));
            void refetch();
          }}
          onArchive={async (entryId) => {
            await handleArchive(entryId);
            setIsFormOpen(false);
          }}
        />
      )}
    </PageContainer>
  );
}
