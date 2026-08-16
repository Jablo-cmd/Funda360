import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useSubjects } from '@/features/academic/hooks/useSubjects';
import { useTeachingAssignments } from '@/features/teaching/hooks/useTeachingAssignments';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import { TeachingAssignmentsTable } from '@/features/teaching/components/TeachingAssignmentsTable';
import { TeachingAssignmentFormModal } from '@/features/teaching/components/TeachingAssignmentFormModal';
import { getDbErrorMessage } from '@/lib/dbErrors';

export function TeachingAssignmentsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('academic.manage');
  const { school } = useSchool();
  const { academicYears } = useAcademic();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const { assignments, isLoading, error, refetch } = useTeachingAssignments(school?.id);

  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [teachersById, setTeachersById] = useState<Record<string, TeacherCandidate>>({});

  const visibleAssignments = showArchived ? assignments : assignments.filter((assignment) => assignment.active);

  const classesById = useMemo(() => Object.fromEntries(classes.map((cls) => [cls.id, cls])), [classes]);
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const academicYearsById = useMemo(() => Object.fromEntries(academicYears.map((year) => [year.id, year])), [academicYears]);

  const teacherProfileIds = useMemo(() => assignments.map((assignment) => assignment.teacherProfileId), [assignments]);

  useEffect(() => {
    const missingIds = [...new Set(teacherProfileIds)].filter((id) => !teachersById[id]);
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

  const handleArchive = async (assignmentId: string) => {
    setActionError(null);
    try {
      await teachingAssignmentService.archiveAssignment(assignmentId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to archive teaching assignment.'));
    }
  };

  const handleRestore = async (assignmentId: string) => {
    setActionError(null);
    try {
      await teachingAssignmentService.restoreAssignment(assignmentId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to restore teaching assignment.'));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/academic')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Academic
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Teaching Assignments</h1>
          <p className="mt-1 text-sm text-content-secondary">
            Assign teachers to classes and subjects for an academic year.
          </p>
        </div>
        {canManage && (
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)} disabled={classes.filter((c) => c.active).length === 0}>
              Add assignment
            </Button>
          </div>
        )}
      </div>

      {canManage && classes.filter((c) => c.active).length === 0 && (
        <p className="text-sm text-content-tertiary">Add an active class before creating assignments.</p>
      )}

      <label className="flex w-fit items-center gap-2 text-sm text-content-secondary">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="focus-ring h-4 w-4 rounded border-border-strong"
        />
        Show archived assignments
      </label>

      {(error ?? actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading teaching assignments…</span>
        </div>
      ) : (
        <TeachingAssignmentsTable
          assignments={visibleAssignments}
          classesById={classesById}
          subjectsById={subjectsById}
          academicYearsById={academicYearsById}
          teachersById={teachersById}
          canManage={canManage}
          onArchive={(assignment) => void handleArchive(assignment.id)}
          onRestore={(assignment) => void handleRestore(assignment.id)}
        />
      )}

      {school && (
        <TeachingAssignmentFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          academicYears={academicYears}
          classes={classes}
          subjects={subjects}
          onSaved={(_, candidate) => {
            if (candidate) setTeachersById((prev) => ({ ...prev, [candidate.id]: candidate }));
            void refetch();
          }}
        />
      )}
    </div>
  );
}
