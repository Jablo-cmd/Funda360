import type { AdmissionApplicationStatus } from '@/lib/database.types';

export type { AdmissionApplicationStatus };

export const ADMISSION_STATUS_LABELS: Record<AdmissionApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  incomplete: 'Incomplete',
  interview_required: 'Interview required',
  assessment_required: 'Assessment required',
  waitlisted: 'Waitlisted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  enrolled: 'Enrolled',
};

/** Pre-decision statuses whose free-text data staff may still edit directly. */
export const ADMISSION_EDITABLE_STATUSES: AdmissionApplicationStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'incomplete',
];

/** Statuses that mean "in the review funnel" — shown on the pipeline dashboard. */
export const ADMISSION_PIPELINE_STATUSES: AdmissionApplicationStatus[] = [
  'submitted',
  'under_review',
  'incomplete',
  'interview_required',
  'assessment_required',
  'waitlisted',
  'accepted',
];

/** The legal next statuses for the workflow bar — mirrors admission_can_transition() in SQL. */
export const ADMISSION_NEXT_STATUSES: Record<AdmissionApplicationStatus, AdmissionApplicationStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'incomplete', 'waitlisted', 'rejected', 'withdrawn'],
  under_review: ['incomplete', 'interview_required', 'assessment_required', 'waitlisted', 'accepted', 'rejected', 'withdrawn'],
  incomplete: ['submitted', 'under_review', 'withdrawn'],
  interview_required: ['under_review', 'assessment_required', 'waitlisted', 'accepted', 'rejected', 'withdrawn'],
  assessment_required: ['under_review', 'interview_required', 'waitlisted', 'accepted', 'rejected', 'withdrawn'],
  waitlisted: ['under_review', 'interview_required', 'assessment_required', 'accepted', 'rejected', 'withdrawn'],
  accepted: ['rejected', 'withdrawn'], // 'enrolled' is via convert, not transition
  rejected: ['under_review'],
  withdrawn: ['under_review'],
  enrolled: [],
};

export interface AdmissionApplication {
  id: string;
  schoolId: string;
  academicYearId: string | null;
  requestedGradeId: string | null;
  referenceNumber: string | null;
  status: AdmissionApplicationStatus;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  applicantEmail: string;
  applicantPhone: string | null;
  applicantRelationship: string | null;
  learnerFirstName: string | null;
  learnerLastName: string | null;
  learnerDateOfBirth: string | null;
  learnerGender: string | null;
  learnerIdNumber: string | null;
  learnerNationality: string | null;
  learnerHomeLanguage: string | null;
  priorSchool: string | null;
  additionalNotes: string | null;
  interviewAt: string | null;
  assessmentAt: string | null;
  decisionAt: string | null;
  decisionReason: string | null;
  convertedLearnerId: string | null;
  submittedAt: string | null;
  isPublicSubmission: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionApplicationEvent {
  id: string;
  applicationId: string;
  eventType: string;
  fromStatus: AdmissionApplicationStatus | null;
  toStatus: AdmissionApplicationStatus | null;
  note: string | null;
  actorProfileId: string | null;
  createdAt: string;
}

export interface AdmissionApplicationDocument {
  id: string;
  applicationId: string;
  schoolId: string;
  requirementId: string | null;
  label: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  verified: boolean;
  uploadedAt: string;
}

export interface AdmissionDocumentRequirement {
  id: string;
  schoolId: string;
  gradeId: string | null;
  label: string;
  description: string | null;
  required: boolean;
  active: boolean;
  sortOrder: number;
}

export interface AdmissionApplicationWithDetail extends AdmissionApplication {
  events: AdmissionApplicationEvent[];
  documents: AdmissionApplicationDocument[];
}
