import { useEffect, useMemo, useState } from 'react';
import { useEnrollments } from '@/features/learners/hooks/useEnrollments';
import { useGrades } from '@/features/academic/hooks/useGrades';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useTeachingAssignments } from '@/features/teaching/hooks/useTeachingAssignments';
import { teachingAssignmentService } from '@/features/teaching/services/teachingAssignmentService';

export interface ChildContextResult {
  gradeName: string | null;
  className: string | null;
  classTeacherName: string | null;
  isLoading: boolean;
}

/**
 * Resolves "which grade/class is this child in, and who is their class
 * teacher" — the same information LearnerProfilePage resolves for staff,
 * simplified to skip academic-year filtering (guardians don't have RLS
 * access to academic_years in V1 — see the parent_portal_v1 migration
 * header for why that scope was deliberately trimmed). The current
 * enrollment is found via enrollmentStatus === 'enrolled', the single
 * field promote_learner() maintains as the source of truth for "which
 * enrollment is current" — not by cross-referencing an active academic
 * year.
 */
export function useChildContext(learnerId: string | undefined, schoolId: string | undefined): ChildContextResult {
  const { enrollments, isLoading: enrollmentsLoading } = useEnrollments(learnerId);
  const { grades, isLoading: gradesLoading } = useGrades(schoolId);
  const { classes, isLoading: classesLoading } = useClasses(schoolId);
  const { assignments, isLoading: assignmentsLoading } = useTeachingAssignments(schoolId);

  const currentEnrollment = useMemo(
    () => enrollments.find((e) => e.enrollmentStatus === 'enrolled'),
    [enrollments],
  );

  const grade = useMemo(
    () => (currentEnrollment ? grades.find((g) => g.id === currentEnrollment.gradeId) : undefined),
    [grades, currentEnrollment],
  );
  const cls = useMemo(
    () => (currentEnrollment?.classId ? classes.find((c) => c.id === currentEnrollment.classId) : undefined),
    [classes, currentEnrollment],
  );

  const classTeacherAssignment = useMemo(
    () => assignments.find((a) => a.classId === cls?.id && !a.subjectId && a.active),
    [assignments, cls],
  );

  const [classTeacherName, setClassTeacherName] = useState<string | null>(null);
  useEffect(() => {
    if (!classTeacherAssignment) {
      setClassTeacherName(null);
      return;
    }
    let isMounted = true;
    void teachingAssignmentService.getTeacherCandidatesByIds([classTeacherAssignment.teacherProfileId]).then((results) => {
      if (isMounted && results[0]) setClassTeacherName(`${results[0].firstName} ${results[0].lastName}`);
    });
    return () => {
      isMounted = false;
    };
  }, [classTeacherAssignment]);

  return {
    gradeName: grade?.name ?? null,
    className: cls?.name ?? null,
    classTeacherName,
    isLoading: enrollmentsLoading || gradesLoading || classesLoading || assignmentsLoading,
  };
}
