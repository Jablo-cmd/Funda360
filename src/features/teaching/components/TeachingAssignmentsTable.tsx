import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import type { ClassTeacherAssignment } from '@/features/teaching/types/teaching.types';
import type { TeacherCandidate } from '@/features/teaching/services/teachingAssignmentService';
import type { Class, Subject, AcademicYear } from '@/features/academic/types/academic.types';

export interface TeachingAssignmentsTableProps {
  assignments: ClassTeacherAssignment[];
  classesById: Record<string, Class>;
  subjectsById: Record<string, Subject>;
  academicYearsById: Record<string, AcademicYear>;
  teachersById: Record<string, TeacherCandidate>;
  canManage: boolean;
  onArchive: (assignment: ClassTeacherAssignment) => void;
  onRestore: (assignment: ClassTeacherAssignment) => void;
}

export function TeachingAssignmentsTable({
  assignments,
  classesById,
  subjectsById,
  academicYearsById,
  teachersById,
  canManage,
  onArchive,
  onRestore,
}: TeachingAssignmentsTableProps) {
  if (assignments.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No teaching assignments yet.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Teacher
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Class
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Subject
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Academic year
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            {canManage && (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment) => {
            const teacher = teachersById[assignment.teacherProfileId];
            const cls = classesById[assignment.classId];
            const subject = assignment.subjectId ? subjectsById[assignment.subjectId] : null;
            const year = academicYearsById[assignment.academicYearId];
            return (
              <tr key={assignment.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-content-primary">
                  {teacher ? `${teacher.firstName} ${teacher.lastName}` : assignment.teacherProfileId}
                </td>
                <td className="px-4 py-3 text-content-secondary">{cls?.name ?? assignment.classId}</td>
                <td className="px-4 py-3 text-content-secondary">
                  {assignment.subjectId ? (subject?.name ?? assignment.subjectId) : 'Class teacher'}
                </td>
                <td className="px-4 py-3 text-content-secondary">{year?.name ?? assignment.academicYearId}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      assignment.active
                        ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                        : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                    }
                  >
                    {assignment.active ? 'Active' : 'Archived'}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => (assignment.active ? onArchive(assignment) : onRestore(assignment))}
                        className={
                          assignment.active
                            ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                            : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                        }
                      >
                        {assignment.active ? 'Archive' : 'Restore'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}
