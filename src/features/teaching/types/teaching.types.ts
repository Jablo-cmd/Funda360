/**
 * Domain types for the Teaching Assignment feature (resolves
 * ADR-0001-teaching-assignment-domain.md). Used only within this feature,
 * so per the type-ownership convention these stay here rather than in the
 * cross-feature src/types/ barrel.
 */

export interface ClassTeacherAssignment {
  id: string;
  schoolId: string;
  academicYearId: string;
  classId: string;
  subjectId: string | null;
  teacherProfileId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassTeacherAssignmentInput {
  academicYearId: string;
  classId: string;
  subjectId?: string | null;
  teacherProfileId: string;
}
