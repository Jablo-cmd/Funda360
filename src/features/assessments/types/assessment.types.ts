/**
 * Domain types for the Assessment feature. Used only within this feature,
 * so per the type-ownership convention these stay here rather than in the
 * cross-feature src/types/ barrel.
 */

export type AssessmentType = 'test' | 'assignment' | 'examination' | 'project' | 'quiz';

export const ASSESSMENT_TYPES: AssessmentType[] = ['test', 'assignment', 'examination', 'project', 'quiz'];

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  test: 'Test',
  assignment: 'Assignment',
  examination: 'Examination',
  project: 'Project',
  quiz: 'Quiz',
};

export interface Assessment {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  subjectId: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxMark: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentInput {
  academicYearId: string;
  termId: string;
  classId: string;
  subjectId: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  maxMark: number;
}

export interface UpdateAssessmentInput {
  title?: string;
  assessmentType?: AssessmentType;
  assessmentDate?: string;
  maxMark?: number;
  active?: boolean;
}

/** A row exists only once a learner has actually been marked — see the migration for why there is no nullable "blank" mark. */
export interface AssessmentResult {
  id: string;
  schoolId: string;
  assessmentId: string;
  learnerId: string;
  mark: number;
  createdAt: string;
  updatedAt: string;
}

export interface RosterLearner {
  id: string;
  firstName: string;
  lastName: string;
  learnerNumber: string;
}

/** One learner's assessment history row, with the parent assessment's context already resolved for display. */
export interface LearnerAssessmentResult {
  resultId: string;
  assessmentId: string;
  title: string;
  assessmentType: AssessmentType;
  assessmentDate: string;
  mark: number;
  maxMark: number;
  subjectId: string;
  termId: string;
  academicYearId: string;
}
