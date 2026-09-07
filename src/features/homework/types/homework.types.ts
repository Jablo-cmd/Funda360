import type { AssignmentStatus, AssignmentSubmissionStatus, Json } from '@/lib/database.types';

export interface RubricCriterion {
  criterion: string;
  points: number;
}

export interface Assignment {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId: string | null;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  assessmentId: string | null;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxPoints: number | null;
  allowResubmission: boolean;
  status: AssignmentStatus;
  rubric: RubricCriterion[];
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface AssignmentResource {
  id: string;
  label: string;
  url: string | null;
  storagePath: string | null;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  learnerId: string;
  learnerName: string | null;
  status: AssignmentSubmissionStatus;
  submissionText: string | null;
  submittedAt: string | null;
  isLate: boolean;
  attemptCount: number;
  pointsAwarded: number | null;
  rubricScores: Json;
  teacherFeedback: string | null;
  markedAt: string | null;
  returnedAt: string | null;
}

export interface CreateAssignmentInput {
  classId: string;
  subjectId: string;
  title: string;
  instructions?: string;
  dueAt?: string | null;
  maxPoints?: number | null;
  termId?: string | null;
  allowResubmission?: boolean;
}
