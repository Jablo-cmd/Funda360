/**
 * Hand-written mirror of supabase/migrations, in the same Row/Insert/Update
 * shape the Supabase CLI's `gen types typescript` produces — a real
 * generated file can drop in later with no changes needed at call sites
 * (`createClient<Database>`, `supabase.from(...)`).
 *
 * Deliberately `type`, not `interface`, throughout (matching what codegen
 * emits): postgrest-js's generic inference for `.update()`/`.insert()`
 * fails to resolve (silently widening query results to `any`, verified
 * with an isolated repro) when Row/Insert/Update are declared as
 * `interface` instead of a plain object `type`.
 */

import type { UserRole } from '@/features/auth/types/auth.types';

/** Matches the shape Supabase's own `gen types typescript` emits for a jsonb column — used only by audit_log.before/after. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary';
export type EmploymentStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';

export type SchoolType = 'public' | 'private' | 'independent';
export type SchoolStatus = 'pending' | 'active' | 'inactive' | 'suspended';
export type ProfileStatus = 'active' | 'inactive' | 'suspended';

export type LearnerStatus =
  | 'prospective'
  | 'applied'
  | 'accepted'
  | 'enrolled'
  | 'active'
  | 'suspended'
  | 'transferred'
  | 'graduated'
  | 'withdrawn';
export type BoardingType = 'day_scholar' | 'boarder';
export type LearnerEnrollmentStatus = 'enrolled' | 'promoted' | 'repeated' | 'transferred_out' | 'withdrawn';
export type GuardianRelationshipType = 'mother' | 'father' | 'legal_guardian' | 'grandparent' | 'sibling' | 'other';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type AssessmentType = 'test' | 'assignment' | 'examination' | 'project' | 'quiz';
export type LearnerDocumentType =
  | 'birth_certificate'
  | 'id_copy'
  | 'passport'
  | 'permit'
  | 'transfer_letter'
  | 'medical_certificate'
  | 'report_card'
  | 'other';
export type FeeCategory = 'tuition' | 'transport' | 'boarding' | 'uniform' | 'activity' | 'other';
export type FeePaymentMethod = 'cash' | 'eft' | 'card' | 'debit_order' | 'cheque' | 'other';
export type BehaviourIncidentType = 'positive' | 'negative';
export type ReportCardStatus = 'draft' | 'teacher_review' | 'hod_review' | 'approved' | 'published' | 'archived';
export type ReportCardPromotion = 'promoted' | 'promoted_conditionally' | 'retained' | 'not_applicable';
export type AdmissionApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'incomplete'
  | 'interview_required'
  | 'assessment_required'
  | 'waitlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'enrolled';
export type BehaviourSeverity = 'low' | 'medium' | 'high';
export type FeeAdjustmentType = 'discount' | 'bursary' | 'scholarship' | 'waiver';
export type FeeAdjustmentMethod = 'percentage' | 'fixed_amount';
export type FeeRefundStatus = 'pending' | 'completed' | 'rejected';
export type InvoiceStatus = 'draft' | 'issued' | 'void';
export type PaymentProvider = 'payfast' | 'ozow' | 'peach' | 'yoco' | 'netcash';
export type PaymentMode = 'test' | 'live';
export type PaymentIntentStatus = 'created' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export type NotificationEmailStatus = 'not_sent' | 'sent' | 'failed';
export type AnnouncementAudience = 'all_staff' | 'all_guardians' | 'everyone';
export type LearnerTransferDirection = 'outgoing' | 'incoming';
export type AcademicInterventionStatus = 'open' | 'in_progress' | 'resolved';
export type TimetableEntryStatus = 'draft' | 'published';
export type LeaveType = 'annual' | 'sick' | 'family_responsibility' | 'unpaid' | 'other';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type SafeguardingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafeguardingStatus = 'open' | 'under_review' | 'escalated' | 'resolved' | 'closed';
export type BehaviourFollowUpStatus = 'not_started' | 'in_progress' | 'resolved';

export type SchoolRow = {
  id: string;
  name: string;
  registration_number: string | null;
  education_department: string | null;
  school_type: SchoolType;
  province: string | null;
  district: string | null;
  emis_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  physical_address: string | null;
  postal_address: string | null;
  principal_name: string | null;
  timezone: string;
  currency: string;
  language: string;
  status: SchoolStatus;
  vat_registered: boolean;
  vat_number: string | null;
  vat_rate: number;
  invoice_number_prefix: string;
  receipt_number_prefix: string;
  invoice_due_days: number;
  invoice_footer_note: string | null;
  banking_details: string | null;
  created_at: string;
  updated_at: string;
};

export type SchoolInsert = {
  id?: string;
  name: string;
  registration_number?: string | null;
  education_department?: string | null;
  school_type?: SchoolType;
  province?: string | null;
  district?: string | null;
  emis_number?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  physical_address?: string | null;
  postal_address?: string | null;
  principal_name?: string | null;
  timezone?: string;
  currency?: string;
  language?: string;
  status?: SchoolStatus;
  vat_registered?: boolean;
  vat_number?: string | null;
  vat_rate?: number;
  invoice_number_prefix?: string;
  receipt_number_prefix?: string;
  invoice_due_days?: number;
  invoice_footer_note?: string | null;
  banking_details?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SchoolUpdate = {
  id?: string;
  name?: string;
  registration_number?: string | null;
  education_department?: string | null;
  school_type?: SchoolType;
  province?: string | null;
  district?: string | null;
  emis_number?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  physical_address?: string | null;
  postal_address?: string | null;
  principal_name?: string | null;
  timezone?: string;
  currency?: string;
  language?: string;
  status?: SchoolStatus;
  vat_registered?: boolean;
  vat_number?: string | null;
  vat_rate?: number;
  invoice_number_prefix?: string;
  receipt_number_prefix?: string;
  invoice_due_days?: number;
  invoice_footer_note?: string | null;
  banking_details?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileRow = {
  id: string;
  tenant_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  tenant_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role?: UserRole | null;
  status?: ProfileStatus;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  id?: string;
  tenant_id?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
  role?: UserRole | null;
  status?: ProfileStatus;
  created_at?: string;
  updated_at?: string;
};

export type AcademicYearRow = {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AcademicYearInsert = {
  id?: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AcademicYearUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TermRow = {
  id: string;
  academic_year_id: string;
  school_id: string;
  name: string;
  sequence: number;
  start_date: string;
  end_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TermInsert = {
  id?: string;
  academic_year_id: string;
  school_id: string;
  name: string;
  sequence: number;
  start_date: string;
  end_date: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TermUpdate = {
  id?: string;
  academic_year_id?: string;
  school_id?: string;
  name?: string;
  sequence?: number;
  start_date?: string;
  end_date?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type GradeRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type GradeInsert = {
  id?: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type GradeUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  sort_order?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ClassRow = {
  id: string;
  grade_id: string;
  school_id: string;
  name: string;
  capacity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClassInsert = {
  id?: string;
  grade_id: string;
  school_id: string;
  name: string;
  capacity: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ClassUpdate = {
  id?: string;
  grade_id?: string;
  school_id?: string;
  name?: string;
  capacity?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SubjectRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubjectInsert = {
  id?: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SubjectUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ClassTeacherAssignmentRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string | null;
  teacher_profile_id: string;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassTeacherAssignmentInsert = {
  id?: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id?: string | null;
  teacher_profile_id: string;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ClassTeacherAssignmentUpdate = {
  id?: string;
  school_id?: string;
  academic_year_id?: string;
  class_id?: string;
  subject_id?: string | null;
  teacher_profile_id?: string;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TimetableEntryRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string | null;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  room: string | null;
  status: TimetableEntryStatus;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TimetableEntryInsert = {
  id?: string;
  school_id: string;
  academic_year_id: string;
  term_id?: string | null;
  class_id: string;
  subject_id: string;
  teacher_profile_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  room?: string | null;
  status?: TimetableEntryStatus;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TimetableEntryUpdate = {
  id?: string;
  school_id?: string;
  academic_year_id?: string;
  term_id?: string | null;
  class_id?: string;
  subject_id?: string;
  teacher_profile_id?: string;
  day_of_week?: DayOfWeek;
  start_time?: string;
  end_time?: string;
  room?: string | null;
  status?: TimetableEntryStatus;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AttendanceRecordRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  learner_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecordInsert = {
  id?: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  learner_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AttendanceRecordUpdate = {
  id?: string;
  school_id?: string;
  academic_year_id?: string;
  class_id?: string;
  learner_id?: string;
  attendance_date?: string;
  status?: AttendanceStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StaffAttendanceRecordRow = {
  id: string;
  school_id: string;
  employee_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffAttendanceRecordInsert = {
  id?: string;
  school_id: string;
  employee_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StaffAttendanceRecordUpdate = {
  id?: string;
  school_id?: string;
  employee_id?: string;
  attendance_date?: string;
  status?: AttendanceStatus;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LeaveRequestRow = {
  id: string;
  school_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaveRequestInsert = {
  id?: string;
  school_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status?: LeaveRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LeaveRequestUpdate = {
  id?: string;
  school_id?: string;
  employee_id?: string;
  leave_type?: LeaveType;
  start_date?: string;
  end_date?: string;
  reason?: string;
  status?: LeaveRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SafeguardingConcernRow = {
  id: string;
  school_id: string;
  learner_id: string;
  category: string | null;
  description: string;
  severity: SafeguardingSeverity;
  status: SafeguardingStatus;
  action_taken: string | null;
  confidential_notes: string | null;
  resolved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SafeguardingConcernInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  category?: string | null;
  description: string;
  severity?: SafeguardingSeverity;
  status?: SafeguardingStatus;
  action_taken?: string | null;
  confidential_notes?: string | null;
  resolved_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SafeguardingConcernUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  category?: string | null;
  description?: string;
  severity?: SafeguardingSeverity;
  status?: SafeguardingStatus;
  action_taken?: string | null;
  confidential_notes?: string | null;
  resolved_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ConsentCategory = 'photo_media_use' | 'marketing_communications' | 'third_party_data_sharing';

export type ConsentRecordRow = {
  id: string;
  school_id: string;
  learner_id: string;
  guardian_profile_id: string;
  category: ConsentCategory;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsentRecordInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  guardian_profile_id: string;
  category: ConsentCategory;
  granted: boolean;
  granted_at?: string | null;
  revoked_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ConsentRecordUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  guardian_profile_id?: string;
  category?: ConsentCategory;
  granted?: boolean;
  granted_at?: string | null;
  revoked_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AssessmentRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  assessment_type: AssessmentType;
  assessment_date: string;
  max_mark: number;
  weight: number;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentInsert = {
  id?: string;
  school_id: string;
  academic_year_id: string;
  term_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  assessment_type: AssessmentType;
  assessment_date: string;
  max_mark: number;
  weight?: number;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AssessmentUpdate = {
  id?: string;
  school_id?: string;
  academic_year_id?: string;
  term_id?: string;
  class_id?: string;
  subject_id?: string;
  title?: string;
  assessment_type?: AssessmentType;
  assessment_date?: string;
  max_mark?: number;
  weight?: number;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AssessmentResultRow = {
  id: string;
  school_id: string;
  assessment_id: string;
  learner_id: string;
  mark: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssessmentResultInsert = {
  id?: string;
  school_id: string;
  assessment_id: string;
  learner_id: string;
  mark: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AssessmentResultUpdate = {
  id?: string;
  school_id?: string;
  assessment_id?: string;
  learner_id?: string;
  mark?: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FeeStructureRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  grade_id: string | null;
  name: string;
  category: FeeCategory;
  amount: number;
  description: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FeeStructureInsert = {
  id?: string;
  school_id: string;
  academic_year_id: string;
  grade_id?: string | null;
  name: string;
  category?: FeeCategory;
  amount: number;
  description?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FeeStructureUpdate = {
  id?: string;
  school_id?: string;
  academic_year_id?: string;
  grade_id?: string | null;
  name?: string;
  category?: FeeCategory;
  amount?: number;
  description?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeeChargeRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  fee_structure_id: string | null;
  invoice_id: string | null;
  description: string;
  category: FeeCategory;
  amount: number;
  due_date: string | null;
  notes: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerFeeChargeInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  fee_structure_id?: string | null;
  invoice_id?: string | null;
  description: string;
  category?: FeeCategory;
  amount: number;
  due_date?: string | null;
  notes?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeeChargeUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  fee_structure_id?: string | null;
  invoice_id?: string | null;
  description?: string;
  category?: FeeCategory;
  amount?: number;
  due_date?: string | null;
  notes?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeePaymentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  amount: number;
  payment_date: string;
  method: FeePaymentMethod;
  reference: string | null;
  notes: string | null;
  active: boolean;
  reconciled_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerFeePaymentInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  amount: number;
  payment_date: string;
  method?: FeePaymentMethod;
  reference?: string | null;
  notes?: string | null;
  active?: boolean;
  reconciled_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeePaymentUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  amount?: number;
  payment_date?: string;
  method?: FeePaymentMethod;
  reference?: string | null;
  notes?: string | null;
  active?: boolean;
  reconciled_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BankStatementLineStatus = 'unmatched' | 'matched' | 'ignored';

export type BankReconciliationImportRow = {
  id: string;
  school_id: string;
  file_name: string;
  imported_at: string;
  created_by: string | null;
};

export type BankReconciliationImportInsert = {
  id?: string;
  school_id: string;
  file_name: string;
  imported_at?: string;
  created_by?: string | null;
};

export type BankReconciliationImportUpdate = {
  id?: string;
  school_id?: string;
  file_name?: string;
  imported_at?: string;
  created_by?: string | null;
};

export type BankStatementLineRow = {
  id: string;
  school_id: string;
  import_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  status: BankStatementLineStatus;
  matched_payment_id: string | null;
  matched_at: string | null;
  matched_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BankStatementLineInsert = {
  id?: string;
  school_id: string;
  import_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  status?: BankStatementLineStatus;
  matched_payment_id?: string | null;
  matched_at?: string | null;
  matched_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BankStatementLineUpdate = {
  id?: string;
  school_id?: string;
  import_id?: string;
  transaction_date?: string;
  description?: string;
  amount?: number;
  status?: BankStatementLineStatus;
  matched_payment_id?: string | null;
  matched_at?: string | null;
  matched_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeeAdjustmentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  charge_id: string | null;
  adjustment_type: FeeAdjustmentType;
  method: FeeAdjustmentMethod;
  percentage: number | null;
  amount: number;
  reason: string;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerFeeAdjustmentInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  charge_id?: string | null;
  adjustment_type?: FeeAdjustmentType;
  method?: FeeAdjustmentMethod;
  percentage?: number | null;
  amount: number;
  reason: string;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeeAdjustmentUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  charge_id?: string | null;
  adjustment_type?: FeeAdjustmentType;
  method?: FeeAdjustmentMethod;
  percentage?: number | null;
  amount?: number;
  reason?: string;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeeRefundRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  payment_id: string;
  amount: number;
  refund_date: string;
  method: FeePaymentMethod;
  reference: string | null;
  reason: string;
  status: FeeRefundStatus;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerFeeRefundInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  payment_id: string;
  amount: number;
  refund_date: string;
  method?: FeePaymentMethod;
  reference?: string | null;
  reason: string;
  status?: FeeRefundStatus;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerFeeRefundUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  payment_id?: string;
  amount?: number;
  refund_date?: string;
  method?: FeePaymentMethod;
  reference?: string | null;
  reason?: string;
  status?: FeeRefundStatus;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InvoiceRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  issued_at: string | null;
  issued_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  notes?: string | null;
  due_date?: string | null;
  issue_date?: string | null;
};

export type InvoiceUpdate = {
  notes?: string | null;
  due_date?: string | null;
  issue_date?: string | null;
};

export type LearnerFeePaymentAllocationRow = {
  id: string;
  school_id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  created_by: string | null;
  created_at: string;
};

export type LearnerFeePaymentAllocationInsert = never;
export type LearnerFeePaymentAllocationUpdate = never;

export type FeeReceiptRow = {
  id: string;
  school_id: string;
  learner_id: string;
  payment_id: string;
  receipt_number: string;
  issued_at: string;
  issued_by: string | null;
};

export type FeeReceiptInsert = never;
export type FeeReceiptUpdate = never;

export type PaymentGatewayConfigRow = {
  id: string;
  school_id: string;
  provider: PaymentProvider;
  mode: PaymentMode;
  enabled: boolean;
  merchant_config: Json;
  secret_last_set_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentGatewayConfigInsert = {
  id?: string;
  school_id: string;
  provider: PaymentProvider;
  mode?: PaymentMode;
  enabled?: boolean;
  merchant_config?: Json;
  secret_last_set_at?: string | null;
};

export type PaymentGatewayConfigUpdate = {
  provider?: PaymentProvider;
  mode?: PaymentMode;
  enabled?: boolean;
  merchant_config?: Json;
  secret_last_set_at?: string | null;
};

export type PaymentIntentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  invoice_id: string | null;
  provider: PaymentProvider;
  mode: PaymentMode;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  reference: string;
  provider_reference: string | null;
  idempotency_key: string;
  return_url: string | null;
  cancel_url: string | null;
  payment_id: string | null;
  failure_reason: string | null;
  raw_request: Json | null;
  raw_result: Json | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type PaymentIntentInsert = never;
export type PaymentIntentUpdate = never;

export type PaymentWebhookEventRow = {
  id: string;
  provider: PaymentProvider;
  mode: PaymentMode;
  provider_event_id: string;
  school_id: string | null;
  intent_id: string | null;
  signature_valid: boolean;
  status_reported: string | null;
  payload: Json;
  processing_error: string | null;
  received_at: string;
  processed_at: string | null;
};

export type PaymentWebhookEventInsert = never;
export type PaymentWebhookEventUpdate = never;

export type BehaviourIncidentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  incident_type: BehaviourIncidentType;
  severity: BehaviourSeverity | null;
  category: string | null;
  occurred_at: string;
  description: string;
  action_taken: string | null;
  outcome: string | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  follow_up_status: BehaviourFollowUpStatus;
  follow_up_assigned_to: string | null;
  follow_up_target_date: string | null;
  follow_up_resolved_at: string | null;
  guardian_visible: boolean;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BehaviourIncidentInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  incident_type: BehaviourIncidentType;
  severity?: BehaviourSeverity | null;
  category?: string | null;
  occurred_at?: string;
  description: string;
  action_taken?: string | null;
  outcome?: string | null;
  follow_up_required?: boolean;
  follow_up_notes?: string | null;
  follow_up_status?: BehaviourFollowUpStatus;
  follow_up_assigned_to?: string | null;
  follow_up_target_date?: string | null;
  follow_up_resolved_at?: string | null;
  guardian_visible?: boolean;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BehaviourIncidentUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  incident_type?: BehaviourIncidentType;
  severity?: BehaviourSeverity | null;
  category?: string | null;
  occurred_at?: string;
  description?: string;
  action_taken?: string | null;
  outcome?: string | null;
  follow_up_required?: boolean;
  follow_up_notes?: string | null;
  follow_up_status?: BehaviourFollowUpStatus;
  follow_up_assigned_to?: string | null;
  follow_up_target_date?: string | null;
  follow_up_resolved_at?: string | null;
  guardian_visible?: boolean;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerRow = {
  id: string;
  school_id: string;
  profile_id: string | null;
  learner_number: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  gender: string | null;
  date_of_birth: string;
  id_number: string | null;
  passport_number: string | null;
  passport_country: string | null;
  nationality: string | null;
  home_language: string | null;
  additional_languages: string[] | null;
  photo_url: string | null;
  transport_mode: string | null;
  transport_notes: string | null;
  boarding_type: BoardingType | null;
  status: LearnerStatus;
  status_reason: string | null;
  admission_date: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerInsert = {
  id?: string;
  school_id: string;
  profile_id?: string | null;
  learner_number: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  gender?: string | null;
  date_of_birth: string;
  id_number?: string | null;
  passport_number?: string | null;
  passport_country?: string | null;
  nationality?: string | null;
  home_language?: string | null;
  additional_languages?: string[] | null;
  photo_url?: string | null;
  transport_mode?: string | null;
  transport_notes?: string | null;
  boarding_type?: BoardingType | null;
  status?: LearnerStatus;
  status_reason?: string | null;
  admission_date: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerUpdate = {
  id?: string;
  school_id?: string;
  profile_id?: string | null;
  learner_number?: string;
  admission_number?: string;
  first_name?: string;
  last_name?: string;
  preferred_name?: string | null;
  gender?: string | null;
  date_of_birth?: string;
  id_number?: string | null;
  passport_number?: string | null;
  passport_country?: string | null;
  nationality?: string | null;
  home_language?: string | null;
  additional_languages?: string[] | null;
  photo_url?: string | null;
  transport_mode?: string | null;
  transport_notes?: string | null;
  boarding_type?: BoardingType | null;
  status?: LearnerStatus;
  status_reason?: string | null;
  admission_date?: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerEnrollmentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  grade_id: string;
  class_id: string | null;
  house: string | null;
  stream: string | null;
  enrollment_date: string;
  enrollment_status: LearnerEnrollmentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerEnrollmentInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  grade_id: string;
  class_id?: string | null;
  house?: string | null;
  stream?: string | null;
  enrollment_date: string;
  enrollment_status?: LearnerEnrollmentStatus;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerEnrollmentUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  grade_id?: string;
  class_id?: string | null;
  house?: string | null;
  stream?: string | null;
  enrollment_date?: string;
  enrollment_status?: LearnerEnrollmentStatus;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerGuardianRow = {
  id: string;
  school_id: string;
  learner_id: string;
  guardian_profile_id: string;
  relationship_type: GuardianRelationshipType;
  is_primary: boolean;
  is_emergency_contact: boolean;
  is_authorized_pickup: boolean;
  custody_notes: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerGuardianInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  guardian_profile_id: string;
  relationship_type: GuardianRelationshipType;
  is_primary?: boolean;
  is_emergency_contact?: boolean;
  is_authorized_pickup?: boolean;
  custody_notes?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerGuardianUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  guardian_profile_id?: string;
  relationship_type?: GuardianRelationshipType;
  is_primary?: boolean;
  is_emergency_contact?: boolean;
  is_authorized_pickup?: boolean;
  custody_notes?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GuardianProfileDetailsRow = {
  id: string;
  school_id: string;
  guardian_profile_id: string;
  address: string | null;
  id_number: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GuardianProfileDetailsInsert = {
  id?: string;
  school_id: string;
  guardian_profile_id: string;
  address?: string | null;
  id_number?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GuardianProfileDetailsUpdate = {
  id?: string;
  school_id?: string;
  guardian_profile_id?: string;
  address?: string | null;
  id_number?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GuardianInvitationStatus = 'pending' | 'accepted' | 'revoked';

export type GuardianInvitationRow = {
  id: string;
  school_id: string;
  guardian_profile_id: string;
  status: GuardianInvitationStatus;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GuardianInvitationInsert = {
  id?: string;
  school_id: string;
  guardian_profile_id: string;
  status?: GuardianInvitationStatus;
  invited_at?: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GuardianInvitationUpdate = {
  id?: string;
  school_id?: string;
  guardian_profile_id?: string;
  status?: GuardianInvitationStatus;
  invited_at?: string;
  expires_at?: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerEmergencyContactRow = {
  id: string;
  school_id: string;
  learner_id: string;
  name: string;
  relationship: string | null;
  phone: string;
  alternate_phone: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerEmergencyContactInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  name: string;
  relationship?: string | null;
  phone: string;
  alternate_phone?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerEmergencyContactUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  name?: string;
  relationship?: string | null;
  phone?: string;
  alternate_phone?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerMedicalInformationRow = {
  id: string;
  school_id: string;
  learner_id: string;
  allergies: string | null;
  medication: string | null;
  medical_conditions: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  medical_aid_provider: string | null;
  medical_aid_number: string | null;
  emergency_medical_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerMedicalInformationInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  allergies?: string | null;
  medication?: string | null;
  medical_conditions?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  medical_aid_provider?: string | null;
  medical_aid_number?: string | null;
  emergency_medical_notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerMedicalInformationUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  allergies?: string | null;
  medication?: string | null;
  medical_conditions?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  medical_aid_provider?: string | null;
  medical_aid_number?: string | null;
  emergency_medical_notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerDocumentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  document_type: LearnerDocumentType;
  file_url: string;
  file_name: string | null;
  uploaded_at: string;
  notes: string | null;
  expiry_date: string | null;
  supersedes_document_id: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerDocumentInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  document_type: LearnerDocumentType;
  file_url: string;
  file_name?: string | null;
  uploaded_at?: string;
  notes?: string | null;
  expiry_date?: string | null;
  supersedes_document_id?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerDocumentUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  document_type?: LearnerDocumentType;
  file_url?: string;
  file_name?: string | null;
  uploaded_at?: string;
  notes?: string | null;
  expiry_date?: string | null;
  supersedes_document_id?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerTransferRow = {
  id: string;
  school_id: string;
  learner_id: string;
  direction: LearnerTransferDirection;
  other_school_name: string;
  other_school_contact: string | null;
  transfer_date: string;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerTransferInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  direction: LearnerTransferDirection;
  other_school_name: string;
  other_school_contact?: string | null;
  transfer_date: string;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LearnerTransferUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  direction?: LearnerTransferDirection;
  other_school_name?: string;
  other_school_contact?: string | null;
  transfer_date?: string;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AcademicInterventionRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  status: AcademicInterventionStatus;
  target_date: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AcademicInterventionInsert = {
  id?: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  subject_id?: string | null;
  title: string;
  description?: string | null;
  status?: AcademicInterventionStatus;
  target_date?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AcademicInterventionUpdate = {
  id?: string;
  school_id?: string;
  learner_id?: string;
  academic_year_id?: string;
  subject_id?: string | null;
  title?: string;
  description?: string | null;
  status?: AcademicInterventionStatus;
  target_date?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TimetableSubstitutionRow = {
  id: string;
  school_id: string;
  timetable_entry_id: string;
  substitute_date: string;
  substitute_teacher_profile_id: string;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TimetableSubstitutionInsert = {
  id?: string;
  school_id: string;
  timetable_entry_id: string;
  substitute_date: string;
  substitute_teacher_profile_id: string;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TimetableSubstitutionUpdate = {
  id?: string;
  school_id?: string;
  timetable_entry_id?: string;
  substitute_date?: string;
  substitute_teacher_profile_id?: string;
  reason?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DepartmentRow = {
  id: string;
  school_id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DepartmentInsert = {
  id?: string;
  school_id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DepartmentUpdate = {
  id?: string;
  school_id?: string;
  name?: string;
  code?: string | null;
  description?: string | null;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeRow = {
  id: string;
  school_id: string;
  profile_id: string | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  work_phone: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  department_id: string | null;
  job_title: string | null;
  employment_type: EmploymentType | null;
  employment_status: EmploymentStatus;
  hire_date: string;
  termination_date: string | null;
  reports_to_employee_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeInsert = {
  id?: string;
  school_id: string;
  profile_id?: string | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  work_email?: string | null;
  work_phone?: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
  department_id?: string | null;
  job_title?: string | null;
  employment_type?: EmploymentType | null;
  employment_status?: EmploymentStatus;
  hire_date: string;
  termination_date?: string | null;
  reports_to_employee_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeUpdate = {
  id?: string;
  school_id?: string;
  profile_id?: string | null;
  employee_number?: string;
  first_name?: string;
  last_name?: string;
  work_email?: string | null;
  work_phone?: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
  department_id?: string | null;
  job_title?: string | null;
  employment_type?: EmploymentType | null;
  employment_status?: EmploymentStatus;
  hire_date?: string;
  termination_date?: string | null;
  reports_to_employee_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type NotificationRow = {
  id: string;
  school_id: string | null;
  recipient_profile_id: string;
  type: string;
  title: string;
  body: string;
  related_entity_table: string | null;
  related_entity_id: string | null;
  link_path: string | null;
  email_status: NotificationEmailStatus;
  read_at: string | null;
  created_at: string;
};

export type NotificationInsert = {
  id?: string;
  school_id?: string | null;
  recipient_profile_id: string;
  type: string;
  title: string;
  body: string;
  related_entity_table?: string | null;
  related_entity_id?: string | null;
  link_path?: string | null;
  email_status?: NotificationEmailStatus;
  read_at?: string | null;
  created_at?: string;
};

export type AuditLogRow = {
  id: string;
  school_id: string | null;
  actor_profile_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string;
  before: Json | null;
  after: Json | null;
  created_at: string;
};

export type AuditLogInsert = {
  id?: string;
  school_id?: string | null;
  actor_profile_id?: string | null;
  action: string;
  entity_table: string;
  entity_id: string;
  before?: Json | null;
  after?: Json | null;
  created_at?: string;
};

export type AnnouncementRow = {
  id: string;
  school_id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementInsert = {
  id?: string;
  school_id: string;
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AnnouncementUpdate = {
  id?: string;
  school_id?: string;
  title?: string;
  body?: string;
  audience?: AnnouncementAudience;
  active?: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GradingScaleRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type GradingScaleInsert = {
  id?: string;
  school_id: string;
  name: string;
  description?: string | null;
  is_default?: boolean;
  active?: boolean;
};
export type GradingScaleUpdate = {
  name?: string;
  description?: string | null;
  is_default?: boolean;
  active?: boolean;
};

export type GradingScaleBandRow = {
  id: string;
  grading_scale_id: string;
  school_id: string;
  code: string;
  label: string;
  descriptor: string | null;
  min_percentage: number;
  max_percentage: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type GradingScaleBandInsert = {
  id?: string;
  grading_scale_id: string;
  school_id: string;
  code: string;
  label: string;
  descriptor?: string | null;
  min_percentage: number;
  max_percentage: number;
  sort_order?: number;
};
export type GradingScaleBandUpdate = {
  code?: string;
  label?: string;
  descriptor?: string | null;
  min_percentage?: number;
  max_percentage?: number;
  sort_order?: number;
};

export type ReportCardTemplateRow = {
  id: string;
  school_id: string;
  name: string;
  grading_scale_id: string;
  is_default: boolean;
  active: boolean;
  show_attendance: boolean;
  show_conduct: boolean;
  show_class_teacher_comment: boolean;
  show_principal_comment: boolean;
  show_subject_comments: boolean;
  show_promotion: boolean;
  requires_hod_review: boolean;
  header_note: string | null;
  footer_note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ReportCardTemplateInsert = {
  id?: string;
  school_id: string;
  name: string;
  grading_scale_id: string;
  is_default?: boolean;
  active?: boolean;
  show_attendance?: boolean;
  show_conduct?: boolean;
  show_class_teacher_comment?: boolean;
  show_principal_comment?: boolean;
  show_subject_comments?: boolean;
  show_promotion?: boolean;
  requires_hod_review?: boolean;
  header_note?: string | null;
  footer_note?: string | null;
};
export type ReportCardTemplateUpdate = Partial<Omit<ReportCardTemplateInsert, 'id' | 'school_id'>>;

export type ReportCardBatchRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string;
  class_id: string;
  template_id: string;
  generated_count: number;
  skipped_count: number;
  created_by: string | null;
  created_at: string;
};
export type ReportCardBatchInsert = never;
export type ReportCardBatchUpdate = never;

export type ReportCardRow = {
  id: string;
  school_id: string;
  learner_id: string;
  academic_year_id: string;
  term_id: string;
  grade_id: string;
  class_id: string;
  template_id: string;
  batch_id: string | null;
  version: number;
  status: ReportCardStatus;
  superseded_by: string | null;
  learner_name: string;
  learner_number: string;
  class_teacher_comment: string | null;
  principal_comment: string | null;
  conduct_summary: string | null;
  promotion_status: ReportCardPromotion;
  overall_average_percentage: number | null;
  overall_achievement_code: string | null;
  overall_achievement_label: string | null;
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  attendance_excused: number;
  attendance_total_days: number;
  conduct_positive_count: number;
  conduct_negative_count: number;
  generated_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  published_by: string | null;
  archived_at: string | null;
  locked_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ReportCardInsert = never;
export type ReportCardUpdate = never;

export type ReportCardSubjectRow = {
  id: string;
  report_card_id: string;
  school_id: string;
  subject_id: string;
  subject_name: string;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  weight: number;
  average_percentage: number | null;
  achievement_code: string | null;
  achievement_label: string | null;
  teacher_comment: string | null;
  assessment_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type ReportCardSubjectInsert = never;
export type ReportCardSubjectUpdate = never;

export type AdmissionDocumentRequirementRow = {
  id: string;
  school_id: string;
  grade_id: string | null;
  label: string;
  description: string | null;
  required: boolean;
  active: boolean;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type AdmissionDocumentRequirementInsert = {
  id?: string;
  school_id: string;
  grade_id?: string | null;
  label: string;
  description?: string | null;
  required?: boolean;
  active?: boolean;
  sort_order?: number;
};
export type AdmissionDocumentRequirementUpdate = Partial<Omit<AdmissionDocumentRequirementInsert, 'id' | 'school_id'>>;

export type AdmissionApplicationRow = {
  id: string;
  school_id: string;
  academic_year_id: string | null;
  requested_grade_id: string | null;
  reference_number: string | null;
  status: AdmissionApplicationStatus;
  resume_token: string;
  applicant_first_name: string | null;
  applicant_last_name: string | null;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_relationship: string | null;
  learner_first_name: string | null;
  learner_last_name: string | null;
  learner_date_of_birth: string | null;
  learner_gender: string | null;
  learner_id_number: string | null;
  learner_nationality: string | null;
  learner_home_language: string | null;
  prior_school: string | null;
  additional_notes: string | null;
  interview_at: string | null;
  assessment_at: string | null;
  decision_at: string | null;
  decision_by: string | null;
  decision_reason: string | null;
  converted_learner_id: string | null;
  submitted_at: string | null;
  is_public_submission: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type AdmissionApplicationInsert = {
  id?: string;
  school_id: string;
  academic_year_id?: string | null;
  requested_grade_id?: string | null;
  applicant_email: string;
  applicant_first_name?: string | null;
  applicant_last_name?: string | null;
  applicant_phone?: string | null;
  applicant_relationship?: string | null;
  learner_first_name?: string | null;
  learner_last_name?: string | null;
  learner_date_of_birth?: string | null;
  learner_gender?: string | null;
  learner_id_number?: string | null;
  learner_nationality?: string | null;
  learner_home_language?: string | null;
  prior_school?: string | null;
  additional_notes?: string | null;
  interview_at?: string | null;
  assessment_at?: string | null;
};
export type AdmissionApplicationUpdate = Partial<Omit<AdmissionApplicationInsert, 'id' | 'school_id' | 'applicant_email'>>;

export type AdmissionApplicationDocumentRow = {
  id: string;
  application_id: string;
  school_id: string;
  requirement_id: string | null;
  label: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  uploaded_at: string;
};
export type AdmissionApplicationDocumentInsert = {
  id?: string;
  application_id: string;
  school_id: string;
  requirement_id?: string | null;
  label: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
};
export type AdmissionApplicationDocumentUpdate = { verified?: boolean; verified_by?: string | null; verified_at?: string | null };

export type AdmissionApplicationEventRow = {
  id: string;
  application_id: string;
  school_id: string;
  event_type: string;
  from_status: AdmissionApplicationStatus | null;
  to_status: AdmissionApplicationStatus | null;
  note: string | null;
  actor_profile_id: string | null;
  created_at: string;
};
export type AdmissionApplicationEventInsert = never;
export type AdmissionApplicationEventUpdate = never;

// --- Communication & Notifications domain (20260907090000_communication.sql) ---

export type ConversationKind = 'direct' | 'group';
export type MessageDeliveryChannel = 'in_app' | 'email' | 'sms' | 'whatsapp';
export type MessageDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type NotificationPreferenceRow = {
  profile_id: string;
  school_id: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  type_overrides: Json;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at: string;
};
export type NotificationPreferenceInsert = {
  profile_id: string;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  type_overrides?: Json;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
};
export type NotificationPreferenceUpdate = Partial<Omit<NotificationPreferenceInsert, 'profile_id'>>;

export type SchoolMessagingSettingsRow = {
  school_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_from_name: string | null;
  email_reply_to: string | null;
  sms_sender_id: string | null;
  email_provider: string | null;
  sms_provider: string | null;
  whatsapp_provider: string | null;
  updated_by: string | null;
  updated_at: string;
};
export type SchoolMessagingSettingsInsert = {
  school_id: string;
  email_enabled?: boolean;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_from_name?: string | null;
  email_reply_to?: string | null;
  sms_sender_id?: string | null;
  email_provider?: string | null;
  sms_provider?: string | null;
  whatsapp_provider?: string | null;
};
export type SchoolMessagingSettingsUpdate = Partial<Omit<SchoolMessagingSettingsInsert, 'school_id'>>;

export type NotificationDeliveryRow = {
  id: string;
  notification_id: string;
  school_id: string | null;
  recipient_profile_id: string;
  channel: MessageDeliveryChannel;
  status: MessageDeliveryStatus;
  provider: string | null;
  destination: string | null;
  provider_message_id: string | null;
  error: string | null;
  attempts: number;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
};
export type NotificationDeliveryInsert = never;
export type NotificationDeliveryUpdate = never;

export type ConversationRow = {
  id: string;
  school_id: string;
  kind: ConversationKind;
  subject: string | null;
  created_by: string | null;
  last_message_at: string;
  message_count: number;
  created_at: string;
};
export type ConversationInsert = never;
export type ConversationUpdate = never;

export type ConversationParticipantRow = {
  id: string;
  conversation_id: string;
  school_id: string;
  profile_id: string;
  last_read_at: string | null;
  archived: boolean;
  muted: boolean;
  added_by: string | null;
  added_at: string;
};
export type ConversationParticipantInsert = never;
export type ConversationParticipantUpdate = { last_read_at?: string | null; archived?: boolean; muted?: boolean };

export type MessageRow = {
  id: string;
  conversation_id: string;
  school_id: string;
  sender_profile_id: string;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};
export type MessageInsert = never;
export type MessageUpdate = never;

export type MessageAttachmentRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  school_id: string;
  label: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
};
export type MessageAttachmentInsert = never;
export type MessageAttachmentUpdate = never;

// --- Homework / Learning domain (20260908090000_homework.sql) ---

export type AssignmentStatus = 'draft' | 'published' | 'closed';
export type AssignmentSubmissionStatus =
  | 'assigned'
  | 'submitted'
  | 'late'
  | 'returned'
  | 'reviewed'
  | 'excused';

export type AssignmentRow = {
  id: string;
  school_id: string;
  academic_year_id: string;
  term_id: string | null;
  class_id: string;
  subject_id: string;
  assessment_id: string | null;
  title: string;
  instructions: string | null;
  due_at: string | null;
  max_points: number | null;
  allow_resubmission: boolean;
  status: AssignmentStatus;
  rubric: Json;
  published_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type AssignmentInsert = never;
export type AssignmentUpdate = {
  title?: string;
  instructions?: string | null;
  due_at?: string | null;
  max_points?: number | null;
  allow_resubmission?: boolean;
  rubric?: Json;
  subject_id?: string;
  term_id?: string | null;
  assessment_id?: string | null;
};

export type AssignmentResourceRow = {
  id: string;
  assignment_id: string;
  school_id: string;
  label: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
};
export type AssignmentResourceInsert = never;
export type AssignmentResourceUpdate = never;

export type AssignmentSubmissionRow = {
  id: string;
  assignment_id: string;
  school_id: string;
  learner_id: string;
  status: AssignmentSubmissionStatus;
  submission_text: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  is_late: boolean;
  attempt_count: number;
  points_awarded: number | null;
  rubric_scores: Json;
  teacher_feedback: string | null;
  marked_by: string | null;
  marked_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
};
export type AssignmentSubmissionInsert = never;
export type AssignmentSubmissionUpdate = never;

export type AssignmentSubmissionFileRow = {
  id: string;
  submission_id: string;
  assignment_id: string;
  school_id: string;
  learner_id: string;
  label: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
};
export type AssignmentSubmissionFileInsert = never;
export type AssignmentSubmissionFileUpdate = never;

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow;
        Insert: SchoolInsert;
        Update: SchoolUpdate;
      };
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      academic_years: {
        Row: AcademicYearRow;
        Insert: AcademicYearInsert;
        Update: AcademicYearUpdate;
      };
      terms: {
        Row: TermRow;
        Insert: TermInsert;
        Update: TermUpdate;
      };
      grades: {
        Row: GradeRow;
        Insert: GradeInsert;
        Update: GradeUpdate;
      };
      classes: {
        Row: ClassRow;
        Insert: ClassInsert;
        Update: ClassUpdate;
      };
      subjects: {
        Row: SubjectRow;
        Insert: SubjectInsert;
        Update: SubjectUpdate;
      };
      assessments: {
        Row: AssessmentRow;
        Insert: AssessmentInsert;
        Update: AssessmentUpdate;
      };
      assessment_results: {
        Row: AssessmentResultRow;
        Insert: AssessmentResultInsert;
        Update: AssessmentResultUpdate;
      };
      fee_structures: {
        Row: FeeStructureRow;
        Insert: FeeStructureInsert;
        Update: FeeStructureUpdate;
      };
      learner_fee_charges: {
        Row: LearnerFeeChargeRow;
        Insert: LearnerFeeChargeInsert;
        Update: LearnerFeeChargeUpdate;
      };
      learner_fee_payments: {
        Row: LearnerFeePaymentRow;
        Insert: LearnerFeePaymentInsert;
        Update: LearnerFeePaymentUpdate;
      };
      bank_reconciliation_imports: {
        Row: BankReconciliationImportRow;
        Insert: BankReconciliationImportInsert;
        Update: BankReconciliationImportUpdate;
      };
      bank_statement_lines: {
        Row: BankStatementLineRow;
        Insert: BankStatementLineInsert;
        Update: BankStatementLineUpdate;
      };
      learner_fee_adjustments: {
        Row: LearnerFeeAdjustmentRow;
        Insert: LearnerFeeAdjustmentInsert;
        Update: LearnerFeeAdjustmentUpdate;
      };
      learner_fee_refunds: {
        Row: LearnerFeeRefundRow;
        Insert: LearnerFeeRefundInsert;
        Update: LearnerFeeRefundUpdate;
      };
      invoices: {
        Row: InvoiceRow;
        Insert: InvoiceInsert;
        Update: InvoiceUpdate;
      };
      learner_fee_payment_allocations: {
        Row: LearnerFeePaymentAllocationRow;
        Insert: LearnerFeePaymentAllocationInsert;
        Update: LearnerFeePaymentAllocationUpdate;
      };
      fee_receipts: {
        Row: FeeReceiptRow;
        Insert: FeeReceiptInsert;
        Update: FeeReceiptUpdate;
      };
      payment_gateway_configs: {
        Row: PaymentGatewayConfigRow;
        Insert: PaymentGatewayConfigInsert;
        Update: PaymentGatewayConfigUpdate;
      };
      payment_intents: {
        Row: PaymentIntentRow;
        Insert: PaymentIntentInsert;
        Update: PaymentIntentUpdate;
      };
      payment_webhook_events: {
        Row: PaymentWebhookEventRow;
        Insert: PaymentWebhookEventInsert;
        Update: PaymentWebhookEventUpdate;
      };
      behaviour_incidents: {
        Row: BehaviourIncidentRow;
        Insert: BehaviourIncidentInsert;
        Update: BehaviourIncidentUpdate;
      };
      class_teacher_assignments: {
        Row: ClassTeacherAssignmentRow;
        Insert: ClassTeacherAssignmentInsert;
        Update: ClassTeacherAssignmentUpdate;
      };
      timetable_entries: {
        Row: TimetableEntryRow;
        Insert: TimetableEntryInsert;
        Update: TimetableEntryUpdate;
      };
      attendance_records: {
        Row: AttendanceRecordRow;
        Insert: AttendanceRecordInsert;
        Update: AttendanceRecordUpdate;
      };
      staff_attendance_records: {
        Row: StaffAttendanceRecordRow;
        Insert: StaffAttendanceRecordInsert;
        Update: StaffAttendanceRecordUpdate;
      };
      leave_requests: {
        Row: LeaveRequestRow;
        Insert: LeaveRequestInsert;
        Update: LeaveRequestUpdate;
      };
      safeguarding_concerns: {
        Row: SafeguardingConcernRow;
        Insert: SafeguardingConcernInsert;
        Update: SafeguardingConcernUpdate;
      };
      consent_records: {
        Row: ConsentRecordRow;
        Insert: ConsentRecordInsert;
        Update: ConsentRecordUpdate;
      };
      learners: {
        Row: LearnerRow;
        Insert: LearnerInsert;
        Update: LearnerUpdate;
      };
      learner_enrollments: {
        Row: LearnerEnrollmentRow;
        Insert: LearnerEnrollmentInsert;
        Update: LearnerEnrollmentUpdate;
      };
      learner_guardians: {
        Row: LearnerGuardianRow;
        Insert: LearnerGuardianInsert;
        Update: LearnerGuardianUpdate;
      };
      guardian_profile_details: {
        Row: GuardianProfileDetailsRow;
        Insert: GuardianProfileDetailsInsert;
        Update: GuardianProfileDetailsUpdate;
      };
      guardian_invitations: {
        Row: GuardianInvitationRow;
        Insert: GuardianInvitationInsert;
        Update: GuardianInvitationUpdate;
      };
      learner_emergency_contacts: {
        Row: LearnerEmergencyContactRow;
        Insert: LearnerEmergencyContactInsert;
        Update: LearnerEmergencyContactUpdate;
      };
      learner_medical_information: {
        Row: LearnerMedicalInformationRow;
        Insert: LearnerMedicalInformationInsert;
        Update: LearnerMedicalInformationUpdate;
      };
      learner_documents: {
        Row: LearnerDocumentRow;
        Insert: LearnerDocumentInsert;
        Update: LearnerDocumentUpdate;
      };
      learner_transfers: {
        Row: LearnerTransferRow;
        Insert: LearnerTransferInsert;
        Update: LearnerTransferUpdate;
      };
      academic_interventions: {
        Row: AcademicInterventionRow;
        Insert: AcademicInterventionInsert;
        Update: AcademicInterventionUpdate;
      };
      timetable_substitutions: {
        Row: TimetableSubstitutionRow;
        Insert: TimetableSubstitutionInsert;
        Update: TimetableSubstitutionUpdate;
      };
      departments: {
        Row: DepartmentRow;
        Insert: DepartmentInsert;
        Update: DepartmentUpdate;
      };
      employees: {
        Row: EmployeeRow;
        Insert: EmployeeInsert;
        Update: EmployeeUpdate;
      };
      notifications: {
        Row: NotificationRow;
        Insert: NotificationInsert;
        Update: Partial<NotificationInsert>;
      };
      audit_log: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: Partial<AuditLogInsert>;
      };
      announcements: {
        Row: AnnouncementRow;
        Insert: AnnouncementInsert;
        Update: AnnouncementUpdate;
      };
      grading_scales: {
        Row: GradingScaleRow;
        Insert: GradingScaleInsert;
        Update: GradingScaleUpdate;
      };
      grading_scale_bands: {
        Row: GradingScaleBandRow;
        Insert: GradingScaleBandInsert;
        Update: GradingScaleBandUpdate;
      };
      report_card_templates: {
        Row: ReportCardTemplateRow;
        Insert: ReportCardTemplateInsert;
        Update: ReportCardTemplateUpdate;
      };
      report_card_batches: {
        Row: ReportCardBatchRow;
        Insert: ReportCardBatchInsert;
        Update: ReportCardBatchUpdate;
      };
      report_cards: {
        Row: ReportCardRow;
        Insert: ReportCardInsert;
        Update: ReportCardUpdate;
      };
      report_card_subjects: {
        Row: ReportCardSubjectRow;
        Insert: ReportCardSubjectInsert;
        Update: ReportCardSubjectUpdate;
      };
      admission_document_requirements: {
        Row: AdmissionDocumentRequirementRow;
        Insert: AdmissionDocumentRequirementInsert;
        Update: AdmissionDocumentRequirementUpdate;
      };
      admission_applications: {
        Row: AdmissionApplicationRow;
        Insert: AdmissionApplicationInsert;
        Update: AdmissionApplicationUpdate;
      };
      admission_application_documents: {
        Row: AdmissionApplicationDocumentRow;
        Insert: AdmissionApplicationDocumentInsert;
        Update: AdmissionApplicationDocumentUpdate;
      };
      admission_application_events: {
        Row: AdmissionApplicationEventRow;
        Insert: AdmissionApplicationEventInsert;
        Update: AdmissionApplicationEventUpdate;
      };
      notification_preferences: {
        Row: NotificationPreferenceRow;
        Insert: NotificationPreferenceInsert;
        Update: NotificationPreferenceUpdate;
      };
      school_messaging_settings: {
        Row: SchoolMessagingSettingsRow;
        Insert: SchoolMessagingSettingsInsert;
        Update: SchoolMessagingSettingsUpdate;
      };
      notification_deliveries: {
        Row: NotificationDeliveryRow;
        Insert: NotificationDeliveryInsert;
        Update: NotificationDeliveryUpdate;
      };
      conversations: {
        Row: ConversationRow;
        Insert: ConversationInsert;
        Update: ConversationUpdate;
      };
      conversation_participants: {
        Row: ConversationParticipantRow;
        Insert: ConversationParticipantInsert;
        Update: ConversationParticipantUpdate;
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: MessageUpdate;
      };
      message_attachments: {
        Row: MessageAttachmentRow;
        Insert: MessageAttachmentInsert;
        Update: MessageAttachmentUpdate;
      };
      assignments: {
        Row: AssignmentRow;
        Insert: AssignmentInsert;
        Update: AssignmentUpdate;
      };
      assignment_resources: {
        Row: AssignmentResourceRow;
        Insert: AssignmentResourceInsert;
        Update: AssignmentResourceUpdate;
      };
      assignment_submissions: {
        Row: AssignmentSubmissionRow;
        Insert: AssignmentSubmissionInsert;
        Update: AssignmentSubmissionUpdate;
      };
      assignment_submission_files: {
        Row: AssignmentSubmissionFileRow;
        Insert: AssignmentSubmissionFileInsert;
        Update: AssignmentSubmissionFileUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_create_user: {
        Args: {
          p_email: string;
          p_first_name: string;
          p_last_name: string;
          p_phone: string | null;
          p_role: UserRole;
          p_tenant_id?: string | null;
        };
        Returns: { user_id: string; temporary_password: string }[];
      };
      admin_create_guardian: {
        Args: {
          p_email: string;
          p_first_name: string;
          p_last_name: string;
          p_phone?: string | null;
          p_tenant_id?: string | null;
          p_address?: string | null;
          p_id_number?: string | null;
        };
        Returns: { user_id: string; temporary_password: string }[];
      };
      admin_update_user_role: {
        Args: { p_user_id: string; p_new_role: UserRole };
        Returns: undefined;
      };
      set_active_academic_year: {
        Args: { p_academic_year_id: string };
        Returns: AcademicYearRow;
      };
      change_learner_status: {
        Args: { p_learner_id: string; p_new_status: LearnerStatus; p_reason?: string | null };
        Returns: LearnerRow;
      };
      promote_learner: {
        Args: {
          p_learner_id: string;
          p_new_academic_year_id: string;
          p_new_grade_id: string;
          p_new_class_id: string | null;
        };
        Returns: LearnerEnrollmentRow;
      };
      terminate_employee: {
        Args: { p_employee_id: string; p_termination_date: string };
        Returns: EmployeeRow;
      };
      reactivate_employee: {
        Args: { p_employee_id: string };
        Returns: EmployeeRow;
      };
      provision_employee_login: {
        Args: { p_employee_id: string; p_role: UserRole; p_phone?: string | null };
        Returns: { user_id: string; temporary_password: string }[];
      };
      send_guardian_invitation: {
        Args: { p_guardian_profile_id: string; p_expires_in_hours?: number };
        Returns: GuardianInvitationRow;
      };
      revoke_guardian_invitation: {
        Args: { p_invitation_id: string };
        Returns: GuardianInvitationRow;
      };
      accept_guardian_invitation: {
        Args: Record<string, never>;
        Returns: GuardianInvitationRow;
      };
      get_my_guardian_invitation: {
        Args: Record<string, never>;
        Returns: {
          guardianFirstName: string;
          guardianLastName: string;
          schoolName: string;
          invitation: {
            id: string;
            status: GuardianInvitationStatus;
            effectiveStatus: GuardianInvitationStatus | 'expired';
            expiresAt: string;
            acceptedAt: string | null;
          } | null;
          children: { id: string; firstName: string; lastName: string }[];
        };
      };
      get_guardian_visible_behaviour_incidents: {
        Args: { p_learner_id: string };
        Returns: {
          id: string;
          learner_id: string;
          incident_type: BehaviourIncidentType;
          severity: BehaviourSeverity | null;
          category: string | null;
          occurred_at: string;
          description: string;
          follow_up_required: boolean;
        }[];
      };
      trigger_fee_overdue_reminders: {
        Args: { p_school_id: string };
        Returns: number;
      };
      reconcile_bank_statement_line: {
        Args: { p_line_id: string; p_payment_id: string };
        Returns: void;
      };
      unreconcile_bank_statement_line: {
        Args: { p_line_id: string };
        Returns: void;
      };
      issue_fee_invoice: {
        Args: { p_invoice_id: string; p_issue_date?: string | null; p_due_date?: string | null };
        Returns: InvoiceRow;
      };
      void_fee_invoice: {
        Args: { p_invoice_id: string; p_reason: string };
        Returns: InvoiceRow;
      };
      allocate_fee_payment: {
        Args: { p_payment_id: string; p_allocations: Json };
        Returns: void;
      };
      issue_fee_receipt: {
        Args: { p_payment_id: string };
        Returns: FeeReceiptRow;
      };
      create_payment_intent: {
        Args: {
          p_learner_id: string;
          p_amount: number;
          p_invoice_id?: string | null;
          p_return_url?: string | null;
          p_cancel_url?: string | null;
        };
        Returns: PaymentIntentRow;
      };
      mark_payment_intent_processing: {
        Args: { p_intent_id: string };
        Returns: PaymentIntentRow;
      };
      resolve_achievement: {
        Args: { p_scale_id: string; p_percentage: number };
        Returns: { code: string; label: string }[];
      };
      generate_report_card: {
        Args: { p_learner_id: string; p_term_id: string; p_template_id: string };
        Returns: ReportCardRow;
      };
      generate_report_cards_for_class: {
        Args: { p_class_id: string; p_term_id: string; p_template_id: string };
        Returns: ReportCardBatchRow;
      };
      recalculate_report_card: {
        Args: { p_report_card_id: string };
        Returns: ReportCardRow;
      };
      set_report_card_subject_comment: {
        Args: { p_subject_row_id: string; p_comment: string };
        Returns: ReportCardSubjectRow;
      };
      set_report_card_comment: {
        Args: { p_report_card_id: string; p_field: string; p_text: string };
        Returns: ReportCardRow;
      };
      set_report_card_promotion: {
        Args: { p_report_card_id: string; p_status: ReportCardPromotion };
        Returns: ReportCardRow;
      };
      submit_report_card: {
        Args: { p_report_card_id: string };
        Returns: ReportCardRow;
      };
      review_report_card: {
        Args: { p_report_card_id: string; p_approve: boolean; p_note?: string | null };
        Returns: ReportCardRow;
      };
      approve_report_card: {
        Args: { p_report_card_id: string };
        Returns: ReportCardRow;
      };
      unapprove_report_card: {
        Args: { p_report_card_id: string; p_reason: string };
        Returns: ReportCardRow;
      };
      publish_report_card: {
        Args: { p_report_card_id: string };
        Returns: ReportCardRow;
      };
      archive_report_card: {
        Args: { p_report_card_id: string };
        Returns: ReportCardRow;
      };
      reissue_report_card: {
        Args: { p_report_card_id: string; p_reason: string };
        Returns: ReportCardRow;
      };
      publish_report_card_batch: {
        Args: { p_batch_id: string };
        Returns: number;
      };
      create_admission_application: {
        Args: {
          p_school_id: string;
          p_applicant_email: string;
          p_applicant_first_name: string;
          p_applicant_last_name: string;
          p_learner_first_name: string;
          p_learner_last_name: string;
          p_academic_year_id?: string | null;
          p_requested_grade_id?: string | null;
          p_applicant_phone?: string | null;
          p_applicant_relationship?: string | null;
          p_learner_date_of_birth?: string | null;
        };
        Returns: AdmissionApplicationRow;
      };
      submit_admission_application: {
        Args: { p_application_id: string };
        Returns: AdmissionApplicationRow;
      };
      transition_admission_application: {
        Args: { p_application_id: string; p_to: AdmissionApplicationStatus; p_note?: string | null };
        Returns: AdmissionApplicationRow;
      };
      add_admission_application_note: {
        Args: { p_application_id: string; p_note: string };
        Returns: undefined;
      };
      convert_admission_application: {
        Args: { p_application_id: string; p_class_id?: string | null; p_provision_guardian_account?: boolean };
        Returns: AdmissionApplicationRow;
      };
      start_conversation: {
        Args: {
          p_participant_profile_ids: string[];
          p_body: string;
          p_subject?: string | null;
          p_kind?: ConversationKind;
        };
        Returns: ConversationRow;
      };
      send_message: {
        Args: { p_conversation_id: string; p_body: string };
        Returns: MessageRow;
      };
      edit_message: {
        Args: { p_message_id: string; p_body: string };
        Returns: MessageRow;
      };
      delete_message: {
        Args: { p_message_id: string };
        Returns: MessageRow;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      set_conversation_flags: {
        Args: { p_conversation_id: string; p_archived?: boolean | null; p_muted?: boolean | null };
        Returns: undefined;
      };
      add_conversation_participants: {
        Args: { p_conversation_id: string; p_profile_ids: string[] };
        Returns: ConversationRow;
      };
      register_message_attachment: {
        Args: {
          p_message_id: string;
          p_label: string;
          p_storage_path: string;
          p_mime_type?: string | null;
          p_size_bytes?: number | null;
        };
        Returns: MessageAttachmentRow;
      };
      can_message_profile: {
        Args: { p_target_profile_id: string };
        Returns: boolean;
      };
      create_assignment: {
        Args: {
          p_school_id: string;
          p_class_id: string;
          p_subject_id: string;
          p_academic_year_id: string;
          p_title: string;
          p_instructions?: string | null;
          p_due_at?: string | null;
          p_max_points?: number | null;
          p_term_id?: string | null;
          p_allow_resubmission?: boolean;
          p_rubric?: Json;
          p_assessment_id?: string | null;
        };
        Returns: AssignmentRow;
      };
      publish_assignment: { Args: { p_assignment_id: string }; Returns: AssignmentRow };
      close_assignment: { Args: { p_assignment_id: string }; Returns: AssignmentRow };
      submit_assignment: {
        Args: { p_assignment_id: string; p_learner_id: string; p_submission_text?: string | null };
        Returns: AssignmentSubmissionRow;
      };
      mark_assignment_submission: {
        Args: {
          p_submission_id: string;
          p_points?: number | null;
          p_feedback?: string | null;
          p_rubric_scores?: Json;
          p_finalise?: boolean;
        };
        Returns: AssignmentSubmissionRow;
      };
      excuse_assignment_submission: {
        Args: { p_submission_id: string; p_reason?: string | null };
        Returns: AssignmentSubmissionRow;
      };
      register_assignment_resource: {
        Args: {
          p_assignment_id: string;
          p_label: string;
          p_url?: string | null;
          p_storage_path?: string | null;
          p_mime_type?: string | null;
          p_size_bytes?: number | null;
        };
        Returns: AssignmentResourceRow;
      };
      register_submission_file: {
        Args: {
          p_submission_id: string;
          p_label: string;
          p_storage_path: string;
          p_mime_type?: string | null;
          p_size_bytes?: number | null;
        };
        Returns: AssignmentSubmissionFileRow;
      };
      is_learner_self: { Args: { p_learner_id: string }; Returns: boolean };
      get_my_admission_applications: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          school_id: string;
          reference_number: string | null;
          status: AdmissionApplicationStatus;
          learner_first_name: string | null;
          learner_last_name: string | null;
          requested_grade_id: string | null;
          submitted_at: string | null;
          decision_at: string | null;
          converted_learner_id: string | null;
          created_at: string;
        }[];
      };
    };
  };
};
