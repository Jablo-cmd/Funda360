import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useEnrollments } from '@/features/learners/hooks/useEnrollments';
import { EnrollmentsTable } from '@/features/learners/components/EnrollmentsTable';
import { EnrollmentFormModal } from '@/features/learners/components/EnrollmentFormModal';
import { PromoteLearnerModal } from '@/features/learners/components/PromoteLearnerModal';

export interface LearnerEnrollmentSectionProps {
  learnerId: string;
  canManage: boolean;
}

export function LearnerEnrollmentSection({ learnerId, canManage }: LearnerEnrollmentSectionProps) {
  const { school } = useSchool();
  const { academicYears } = useAcademic();
  const { grades } = useGrades(school?.id);
  const { classes } = useClasses(school?.id);
  const { enrollments, isLoading, error, refetch } = useEnrollments(learnerId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex flex-wrap justify-end gap-3">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" variant="secondary" onClick={() => setIsPromoteOpen(true)}>
              Promote
            </Button>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              Add enrollment
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <span
            aria-hidden="true"
            className="h-6 w-6 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
        </div>
      ) : (
        <EnrollmentsTable enrollments={enrollments} academicYears={academicYears} grades={grades} classes={classes} />
      )}

      {school && (
        <>
          <EnrollmentFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            schoolId={school.id}
            learnerId={learnerId}
            academicYears={academicYears}
            grades={grades}
            classes={classes}
            onSaved={() => void refetch()}
          />
          <PromoteLearnerModal
            isOpen={isPromoteOpen}
            onClose={() => setIsPromoteOpen(false)}
            learnerId={learnerId}
            academicYears={academicYears}
            grades={grades}
            classes={classes}
            onPromoted={() => void refetch()}
          />
        </>
      )}
    </div>
  );
}
