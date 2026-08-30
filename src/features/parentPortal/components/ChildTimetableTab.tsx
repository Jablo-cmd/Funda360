import { useEffect, useMemo, useState } from 'react';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { WeeklyTimetableGrid } from '@/features/timetable/components/WeeklyTimetableGrid';
import { useTimetableEntries } from '@/features/timetable/hooks/useTimetableEntries';
import { useEnrollments } from '@/features/learners/hooks/useEnrollments';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';

export interface ChildTimetableTabProps {
  learnerId: string;
  schoolId: string;
}

/**
 * The child's current class is resolved from their own 'enrolled'
 * learner_enrollments row — the same source-of-truth field
 * useChildContext() already relies on — rather than guardians needing RLS
 * access to `academic_years` to find "the current year" (deliberately not
 * granted in V1, see parent_portal_v1's migration header). The enrollment
 * row's own academicYearId is enough to fetch that year's timetable.
 * timetable_entries_select_for_guardians (see
 * 20260829120000_parent_portal_timetable_and_documents.sql) is what
 * actually authorises the read; this component only narrows it to one
 * class client-side, the same way the staff-facing TimetablePage narrows a
 * school-wide fetch to one class/teacher.
 */
export function ChildTimetableTab({ learnerId, schoolId }: ChildTimetableTabProps) {
  const { enrollments, isLoading: enrollmentsLoading } = useEnrollments(learnerId);
  const currentEnrollment = useMemo(() => enrollments.find((e) => e.enrollmentStatus === 'enrolled'), [enrollments]);

  const { entries, isLoading: entriesLoading, error } = useTimetableEntries(schoolId, currentEnrollment?.academicYearId);
  const { classes, isLoading: classesLoading } = useClasses(schoolId);
  const { subjects, isLoading: subjectsLoading } = useSubjects(schoolId);

  const classEntries = useMemo(
    () => (currentEnrollment?.classId ? entries.filter((entry) => entry.classId === currentEnrollment.classId) : []),
    [entries, currentEnrollment],
  );

  const classesById = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c])), [classes]);
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);

  const [teachersById, setTeachersById] = useState<Record<string, TeacherCandidate>>({});
  useEffect(() => {
    const ids = [...new Set(classEntries.map((entry) => entry.teacherProfileId))];
    if (ids.length === 0) {
      setTeachersById({});
      return;
    }
    let isMounted = true;
    void teachingAssignmentService.getTeacherCandidatesByIds(ids).then((results) => {
      if (isMounted) setTeachersById(Object.fromEntries(results.map((t) => [t.id, t])));
    });
    return () => {
      isMounted = false;
    };
  }, [classEntries]);

  const isLoading = enrollmentsLoading || entriesLoading || classesLoading || subjectsLoading;

  if (isLoading) {
    return <LoadingBlock label="Loading timetable…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert message={error} />

      {!currentEnrollment?.classId ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No current class enrollment — a timetable isn't available yet.
        </p>
      ) : (
        <WeeklyTimetableGrid
          entries={classEntries}
          classesById={classesById}
          subjectsById={subjectsById}
          teachersById={teachersById}
          showClassLabel={false}
          showTeacherLabel
          canManage={false}
          onEdit={() => undefined}
        />
      )}
    </div>
  );
}
