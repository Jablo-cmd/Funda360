import type { LearnerEnrollment } from '@/features/learners/types/learner.types';
import type { AcademicYear, Grade, Class } from '@/features/academic/types/academic.types';

export interface EnrollmentsTableProps {
  enrollments: LearnerEnrollment[];
  academicYears: AcademicYear[];
  grades: Grade[];
  classes: Class[];
}

export function EnrollmentsTable({ enrollments, academicYears, grades, classes }: EnrollmentsTableProps) {
  if (enrollments.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No enrollment history yet.
      </div>
    );
  }

  const yearName = (id: string) => academicYears.find((year) => year.id === id)?.name ?? '—';
  const gradeName = (id: string) => grades.find((grade) => grade.id === id)?.name ?? '—';
  const className = (id: string | null) => (id ? (classes.find((cls) => cls.id === id)?.name ?? '—') : '—');

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Academic year
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Grade
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Class
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Enrolled
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr key={enrollment.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">{yearName(enrollment.academicYearId)}</td>
              <td className="px-4 py-3 text-content-secondary">{gradeName(enrollment.gradeId)}</td>
              <td className="px-4 py-3 text-content-secondary">{className(enrollment.classId)}</td>
              <td className="px-4 py-3 text-content-secondary">{enrollment.enrollmentDate}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium capitalize text-content-tertiary">
                  {enrollment.enrollmentStatus.replace(/_/g, ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
