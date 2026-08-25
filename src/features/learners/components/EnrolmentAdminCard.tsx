import { Card } from '@/components/ui/Card';
import type { Learner, LearnerEnrollment } from '@/features/learners/types/learner.types';
import type { AcademicYear, Grade, Class } from '@/features/academic/types/academic.types';

export interface EnrolmentAdminCardProps {
  learner: Learner;
  enrollments: LearnerEnrollment[];
  academicYears: AcademicYear[];
  grades: Grade[];
  classes: Class[];
  onViewAll: () => void;
}

export function EnrolmentAdminCard({ learner, enrollments, academicYears, grades, classes, onViewAll }: EnrolmentAdminCardProps) {
  const yearName = (id: string) => academicYears.find((year) => year.id === id)?.name ?? '—';
  const gradeName = (id: string) => grades.find((grade) => grade.id === id)?.name ?? '—';
  const className = (id: string | null) => (id ? (classes.find((cls) => cls.id === id)?.name ?? '—') : '—');

  const sortedHistory = [...enrollments].sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate));

  return (
    <Card
      title="Enrolment"
      action={
        <button type="button" onClick={onViewAll} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          View history
        </button>
      }
    >
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-content-tertiary">Admission date</dt>
          <dd className="text-content-primary">{learner.admissionDate}</dd>
        </div>
        <div>
          <dt className="text-xs text-content-tertiary">Boarding type</dt>
          <dd className="capitalize text-content-primary">{learner.boardingType?.replace(/_/g, ' ') ?? '—'}</dd>
        </div>
      </dl>

      {sortedHistory.length > 0 && (
        <div className="mt-1 flex flex-col divide-y divide-border border-t border-border pt-3">
          {sortedHistory.slice(0, 3).map((enrollment) => (
            <div key={enrollment.id} className="flex items-center justify-between py-1.5 text-sm first:pt-0 last:pb-0">
              <span className="text-content-secondary">{yearName(enrollment.academicYearId)}</span>
              <span className="text-content-primary">
                {gradeName(enrollment.gradeId)} · {className(enrollment.classId)}
              </span>
            </div>
          ))}
        </div>
      )}

      {learner.statusReason && (
        <p className="mt-1 border-t border-border pt-3 text-sm text-content-secondary">
          <span className="font-medium text-content-primary">Status reason:</span> {learner.statusReason}
        </p>
      )}
    </Card>
  );
}
