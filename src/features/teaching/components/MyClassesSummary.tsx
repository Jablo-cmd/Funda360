import type { ClassTeacherAssignment } from '@/features/teaching/types/teaching.types';
import type { Class, Subject, AcademicYear } from '@/features/academic/types/academic.types';

export interface MyClassesSummaryProps {
  assignment: ClassTeacherAssignment;
  cls: Class | undefined;
  subject: Subject | undefined;
  academicYear: AcademicYear | undefined;
}

/** Read-only self-view summary of one of the caller's own teaching assignments — no manage actions, unlike TeachingAssignmentsPage. */
export function MyClassesSummary({ assignment, cls, subject, academicYear }: MyClassesSummaryProps) {
  return (
    <div className="rounded-card border border-border bg-surface-raised p-5 shadow-card dark:shadow-card-dark">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-content-primary">{cls?.name ?? 'Class'}</h3>
          <p className="text-sm text-content-secondary">
            {assignment.subjectId ? (subject?.name ?? 'Subject') : 'Class teacher'}
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          {academicYear?.name ?? 'Academic year'}
        </span>
      </div>
    </div>
  );
}
