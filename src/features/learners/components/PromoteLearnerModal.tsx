import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { enrollmentService } from '@/features/learners/services/enrollmentService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { LearnerEnrollment } from '@/features/learners/types/learner.types';
import type { AcademicYear, Grade, Class } from '@/features/academic/types/academic.types';

export interface PromoteLearnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnerId: string;
  academicYears: AcademicYear[];
  grades: Grade[];
  classes: Class[];
  onPromoted: (enrollment: LearnerEnrollment) => void;
}

export function PromoteLearnerModal({
  isOpen,
  onClose,
  learnerId,
  academicYears,
  grades,
  classes,
  onPromoted,
}: PromoteLearnerModalProps) {
  const activeGrades = useMemo(() => grades.filter((grade) => grade.active), [grades]);
  const currentYear = academicYears.find((year) => year.isActive) ?? academicYears[0];

  const [academicYearId, setAcademicYearId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [classId, setClassId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAcademicYearId(currentYear?.id ?? '');
    setGradeId(activeGrades[0]?.id ?? '');
    setClassId('');
    setSubmitError(null);
  }, [isOpen, currentYear, activeGrades]);

  const classesForGrade = useMemo(
    () => classes.filter((cls) => cls.active && cls.gradeId === gradeId),
    [classes, gradeId],
  );

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const enrollment = await enrollmentService.promote(learnerId, academicYearId, gradeId, classId || null);
      onPromoted(enrollment);
      onClose();
    } catch (error) {
      setSubmitError(getDbErrorMessage(error, 'Failed to promote learner.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Promote learner"
      footer={
        <div className="flex justify-end gap-3">
          <div className="w-28">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="w-32">
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              isLoading={isSubmitting}
              disabled={!academicYearId || !gradeId}
            >
              {isSubmitting ? 'Promoting…' : 'Promote'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {submitError}
          </div>
        )}

        <div>
          <label htmlFor="promote-year" className="mb-1.5 block text-sm font-medium text-content-primary">
            New academic year
          </label>
          <select
            id="promote-year"
            value={academicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="promote-grade" className="mb-1.5 block text-sm font-medium text-content-primary">
            New grade
          </label>
          <select
            id="promote-grade"
            value={gradeId}
            onChange={(event) => {
              setGradeId(event.target.value);
              setClassId('');
            }}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            {activeGrades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="promote-class" className="mb-1.5 block text-sm font-medium text-content-primary">
            New class
          </label>
          <select
            id="promote-class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            className="focus-ring h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-sm text-content-primary"
          >
            <option value="">Unassigned</option>
            {classesForGrade.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
