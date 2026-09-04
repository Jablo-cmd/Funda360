import type { ReportCardStatus, ReportCardPromotion } from '@/lib/database.types';

export type { ReportCardStatus, ReportCardPromotion };

export const REPORT_CARD_STATUS_ORDER: ReportCardStatus[] = [
  'draft',
  'teacher_review',
  'hod_review',
  'approved',
  'published',
  'archived',
];

export const REPORT_CARD_STATUS_LABELS: Record<ReportCardStatus, string> = {
  draft: 'Draft',
  teacher_review: 'Teacher review',
  hod_review: 'HOD review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
};

export const REPORT_CARD_PROMOTION_LABELS: Record<ReportCardPromotion, string> = {
  promoted: 'Promoted',
  promoted_conditionally: 'Promoted (conditional)',
  retained: 'Retained',
  not_applicable: 'Not applicable',
};

/** A status at or past `approved` is locked — the workflow RPCs reject edits. */
export function isReportCardLocked(status: ReportCardStatus): boolean {
  return status === 'approved' || status === 'published' || status === 'archived';
}

export interface GradingScaleBand {
  id: string;
  gradingScaleId: string;
  schoolId: string;
  code: string;
  label: string;
  descriptor: string | null;
  minPercentage: number;
  maxPercentage: number;
  sortOrder: number;
}

export interface GradingScale {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GradingScaleWithBands extends GradingScale {
  bands: GradingScaleBand[];
}

export interface ReportCardTemplate {
  id: string;
  schoolId: string;
  name: string;
  gradingScaleId: string;
  isDefault: boolean;
  active: boolean;
  showAttendance: boolean;
  showConduct: boolean;
  showClassTeacherComment: boolean;
  showPrincipalComment: boolean;
  showSubjectComments: boolean;
  showPromotion: boolean;
  requiresHodReview: boolean;
  headerNote: string | null;
  footerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCardSubject {
  id: string;
  reportCardId: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  teacherProfileId: string | null;
  teacherName: string | null;
  weight: number;
  averagePercentage: number | null;
  achievementCode: string | null;
  achievementLabel: string | null;
  teacherComment: string | null;
  assessmentCount: number;
  sortOrder: number;
}

export interface ReportCard {
  id: string;
  schoolId: string;
  learnerId: string;
  academicYearId: string;
  termId: string;
  gradeId: string;
  classId: string;
  templateId: string;
  batchId: string | null;
  version: number;
  status: ReportCardStatus;
  supersededBy: string | null;
  learnerName: string;
  learnerNumber: string;
  classTeacherComment: string | null;
  principalComment: string | null;
  conductSummary: string | null;
  promotionStatus: ReportCardPromotion;
  overallAveragePercentage: number | null;
  overallAchievementCode: string | null;
  overallAchievementLabel: string | null;
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceLate: number;
  attendanceExcused: number;
  attendanceTotalDays: number;
  conductPositiveCount: number;
  conductNegativeCount: number;
  generatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCardWithSubjects extends ReportCard {
  subjects: ReportCardSubject[];
}

export interface ReportCardBatch {
  id: string;
  schoolId: string;
  academicYearId: string;
  termId: string;
  classId: string;
  templateId: string;
  generatedCount: number;
  skippedCount: number;
  createdAt: string;
}
