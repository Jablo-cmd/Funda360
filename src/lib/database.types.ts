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


export type TransportVehicleStatus = 'active' | 'maintenance' | 'inactive';
export type TransportDriverStatus = 'active' | 'suspended' | 'inactive';
export type TransportAssignmentStatus = 'active' | 'suspended' | 'ended';
export type TransportTripStatus = 'scheduled' | 'boarding' | 'in_progress' | 'completed' | 'cancelled';
export type TransportAttendanceStatus = 'boarded' | 'absent' | 'picked_up' | 'dropped_off' | 'no_show';

export type TransportVehicleRow = {
  id: string; school_id: string; registration_number: string; fleet_number: string | null;
  make: string | null; model: string | null; year: number | null; capacity: number;
  status: TransportVehicleStatus; notes: string | null; created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string;
};
export type TransportVehicleInsert = Omit<TransportVehicleRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'> & Partial<Pick<TransportVehicleRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'>>;
export type TransportVehicleUpdate = Partial<Omit<TransportVehicleRow,'id'>>;

export type TransportDriverRow = {
  id: string; school_id: string; employee_id: string | null; first_name: string; last_name: string;
  phone: string | null; licence_number: string | null; licence_expiry: string | null;
  status: TransportDriverStatus; notes: string | null; created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string;
};
export type TransportDriverInsert = Omit<TransportDriverRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'> & Partial<Pick<TransportDriverRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'>>;
export type TransportDriverUpdate = Partial<Omit<TransportDriverRow,'id'>>;

export type TransportRouteRow = {
  id: string; school_id: string; name: string; code: string; direction: 'morning'|'afternoon'|'both';
  active: boolean; notes: string | null; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
};
export type TransportRouteInsert = Omit<TransportRouteRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'> & Partial<Pick<TransportRouteRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'>>;
export type TransportRouteUpdate = Partial<Omit<TransportRouteRow,'id'>>;

export type TransportStopRow = {
  id: string; school_id: string; name: string; address: string | null; latitude: number | null; longitude: number | null;
  pickup_time: string | null; dropoff_time: string | null; active: boolean; created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string;
};
export type TransportStopInsert = Omit<TransportStopRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'> & Partial<Pick<TransportStopRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'>>;
export type TransportStopUpdate = Partial<Omit<TransportStopRow,'id'>>;

export type TransportRouteStopRow = { id:string; school_id:string; route_id:string; stop_id:string; stop_order:number; pickup_time:string|null; dropoff_time:string|null; created_by:string|null; created_at:string; };
export type TransportRouteStopInsert = Omit<TransportRouteStopRow,'id'|'created_by'|'created_at'> & Partial<Pick<TransportRouteStopRow,'id'|'created_by'|'created_at'>>;
export type TransportRouteStopUpdate = Partial<Omit<TransportRouteStopRow,'id'>>;

export type TransportAssignmentRow = {
  id:string; school_id:string; learner_id:string; route_id:string; pickup_stop_id:string|null; dropoff_stop_id:string|null;
  effective_from:string; effective_to:string|null; status:TransportAssignmentStatus; notes:string|null;
  created_by:string|null; updated_by:string|null; created_at:string; updated_at:string;
};
export type TransportAssignmentInsert = Omit<TransportAssignmentRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'|'status'> & Partial<Pick<TransportAssignmentRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'|'status'>>;
export type TransportAssignmentUpdate = Partial<Omit<TransportAssignmentRow,'id'>>;

export type TransportScheduleRow = {
  id:string; school_id:string; route_id:string; vehicle_id:string; driver_id:string|null; service_date:string;
  departure_time:string|null; status:TransportTripStatus; notes:string|null; created_by:string|null; updated_by:string|null; created_at:string; updated_at:string;
};
export type TransportScheduleInsert = Omit<TransportScheduleRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'|'status'> & Partial<Pick<TransportScheduleRow,'id'|'created_by'|'updated_by'|'created_at'|'updated_at'|'status'>>;
export type TransportScheduleUpdate = Partial<Omit<TransportScheduleRow,'id'>>;

export type TransportAttendanceRow = {
  id:string; school_id:string; schedule_id:string; learner_id:string; status:TransportAttendanceStatus;
  recorded_at:string; recorded_by:string|null; notes:string|null;
};
export type TransportAttendanceInsert = never;
export type TransportAttendanceUpdate = never;


// ---------------------------------------------------------------------------
// Compliance framework (20260930100000_compliance_framework.sql)
// ---------------------------------------------------------------------------

export type ComplianceFramework = 'POPIA' | 'FERPA' | 'COPPA' | 'CIPA' | 'GDPR';
export type ConsentPurpose =
  | 'core_educational_processing'
  | 'online_learner_account'
  | 'directory_information'
  | 'third_party_sharing'
  | 'photo_media_use';
export type ConsentDecision = 'granted' | 'refused' | 'withdrawn';
export type ConsentMethod = 'in_app_attestation' | 'paper_form_recorded_by_staff';
export type AmendmentStatus = 'submitted' | 'under_review' | 'approved' | 'denied' | 'hearing_requested' | 'closed';
export type AmendmentRecordArea =
  | 'personal_details'
  | 'attendance'
  | 'assessment'
  | 'report_card'
  | 'behaviour'
  | 'medical'
  | 'financial'
  | 'other';
export type DisclosureRecipientType =
  | 'school_official'
  | 'transfer_school'
  | 'education_authority'
  | 'health_safety_emergency'
  | 'court_order_or_subpoena'
  | 'parental_consent'
  | 'directory_information'
  | 'other_lawful_basis';
export type RecordAccessType = 'view' | 'export' | 'print' | 'disclosure' | 'amendment' | 'erasure';
export type ContentSafetyCategory = 'adult' | 'gambling' | 'violence' | 'self_harm' | 'bullying' | 'drugs' | 'hate' | 'custom';
export type ContentSafetyEventStatus = 'open' | 'reviewed_no_action' | 'escalated' | 'resolved';
export type DsarRequestType = 'access' | 'correction' | 'restriction' | 'deletion' | 'portability';
export type DsarStatus = 'received' | 'identity_verified' | 'processing' | 'completed' | 'rejected';

export type SchoolComplianceSettingsRow = {
  school_id: string;
  frameworks: ComplianceFramework[];
  coppa_consent_age: number;
  gdpr_digital_consent_age: number;
  ferpa_amendment_response_days: number;
  dsar_response_days: number;
  content_filter_enabled: boolean;
  information_officer_name: string | null;
  information_officer_email: string | null;
  privacy_notice_version: string;
  updated_by: string | null;
  updated_at: string;
};

export type ParentalConsentRow = {
  id: string;
  school_id: string;
  learner_id: string;
  guardian_profile_id: string | null;
  purpose: ConsentPurpose;
  decision: ConsentDecision;
  method: ConsentMethod;
  attested_name: string | null;
  policy_version: string;
  recorded_by: string | null;
  decided_at: string;
};

export type StudentRecordAccessLogRow = {
  id: string;
  school_id: string;
  learner_id: string;
  actor_profile_id: string | null;
  actor_role: string;
  access_type: RecordAccessType;
  context: string;
  created_at: string;
};

export type RecordAmendmentRequestRow = {
  id: string;
  school_id: string;
  learner_id: string;
  requested_by: string | null;
  record_area: AmendmentRecordArea;
  record_reference: string | null;
  current_value: string | null;
  requested_change: string;
  reason: string;
  status: AmendmentStatus;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  due_by: string;
  disagreement_statement: string | null;
  hearing_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecordDisclosureRow = {
  id: string;
  school_id: string;
  learner_id: string;
  disclosed_to: string;
  recipient_type: DisclosureRecipientType;
  legal_basis: string;
  data_categories: string[];
  disclosed_by: string | null;
  disclosed_at: string;
};

export type ContentSafetyRuleRow = {
  id: string;
  school_id: string | null;
  category: ContentSafetyCategory;
  pattern: string;
  action: 'block' | 'flag';
  description: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
};

export type ContentSafetyEventRow = {
  id: string;
  school_id: string;
  rule_id: string | null;
  category: ContentSafetyCategory;
  action: 'block' | 'flag';
  source_table: string;
  source_id: string | null;
  actor_profile_id: string | null;
  excerpt: string | null;
  status: ContentSafetyEventStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export type DataSubjectRequestRow = {
  id: string;
  school_id: string;
  subject_profile_id: string | null;
  subject_learner_id: string | null;
  request_type: DsarRequestType;
  status: DsarStatus;
  reason: string | null;
  requested_at: string;
  completed_at: string | null;
  handled_by: string | null;
  outcome_notes: string | null;
  requested_by: string | null;
  due_at: string | null;
};

/** Tables written only through SECURITY DEFINER RPCs — clients never insert/update them directly. */
// ---------------------------------------------------------------------------
// Curriculum engine (20261001090000 / 20261001100000)
// ---------------------------------------------------------------------------
export type ContentStatus = 'draft' | 'review' | 'approved' | 'published' | 'retired';
export type ToolkitStage = 'explain' | 'show' | 'try' | 'practise' | 'check' | 'support' | 'challenge' | 'print';
export type ContentDifficulty = 'foundational' | 'standard' | 'advanced';
export type ConnectivityNeed = 'none' | 'low' | 'online';
export type DeviceNeed = 'none' | 'teacher_device' | 'shared_device' | 'learner_device';
export type LearnerProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_support' | 'mastered';
export type ResourceKind =
  | 'teacher_explanation' | 'simplified_explanation' | 'worked_example' | 'diagram' | 'illustration' | 'animation' | 'video'
  | 'classroom_activity' | 'group_activity' | 'practical_activity' | 'exercise' | 'differentiated_exercise'
  | 'quick_assessment' | 'formative_questions' | 'remediation' | 'extension' | 'worksheet' | 'teacher_resource';

export type CurriculumVersionRow = {
  id: string; code: string; name: string; version_label: string; source: string; source_reference: string | null;
  license_notes: string | null; status: ContentStatus; effective_from: string | null; effective_to: string | null;
  supersedes_version_id: string | null; created_at: string; updated_at: string;
};
export type CurriculumGradeRow = { id: string; version_id: string; phase_id: string; grade_number: number; name: string; sort_order: number };
export type CurriculumSubjectRow = { id: string; version_id: string; code: string; name: string; language: string; sort_order: number };
export type CurriculumGradeSubjectRow = { id: string; version_id: string; grade_id: string; subject_id: string };
export type CurriculumTermRow = { id: string; version_id: string; grade_subject_id: string; term_number: number; weeks: number | null };
export type CurriculumTopicRow = {
  id: string; version_id: string; term_id: string; code: string; title: string; description: string | null;
  language: string; status: ContentStatus; sort_order: number;
};
export type CurriculumObjectiveRow = {
  id: string; version_id: string; topic_id: string; subtopic_id: string | null; code: string; description: string;
  language: string; source_reference: string | null; status: ContentStatus; sort_order: number;
};
export type LessonRow = {
  id: string; lineage_id: string; version_number: number; curriculum_version_id: string; grade_subject_id: string; topic_id: string;
  title: string; description: string | null; estimated_minutes: number | null; difficulty: ContentDifficulty; language: string;
  status: ContentStatus; teacher_notes: string | null; learner_instructions: string | null; sort_order: number;
  accessibility: Json; origin: 'authored' | 'ai_draft'; ai_disclosure: string | null; created_at: string; updated_at: string;
};
export type LessonObjectiveRow = { lesson_id: string; objective_id: string; curriculum_version_id: string; is_primary: boolean };
export type TeachingResourceRow = {
  id: string; lineage_id: string; version_number: number; curriculum_version_id: string; grade_subject_id: string; topic_id: string;
  stage: ToolkitStage; resource_kind: ResourceKind; title: string; summary: string | null; body: Json; difficulty: ContentDifficulty;
  language: string; estimated_minutes: number | null; delivery_formats: string[]; connectivity: ConnectivityNeed; device: DeviceNeed;
  projector_required: boolean; printable: boolean; cacheable: boolean; size_kb: number | null; media_path: string | null;
  accessibility: Json; origin: 'authored' | 'ai_draft'; ai_disclosure: string | null; status: ContentStatus; created_at: string; updated_at: string;
};
export type LessonResourceRow = { lesson_id: string; resource_id: string; curriculum_version_id: string; sort_order: number };
export type ResourceObjectiveRow = { resource_id: string; objective_id: string; curriculum_version_id: string };
export type LearningActivityRow = {
  id: string; lesson_id: string; curriculum_version_id: string; title: string; instructions: string; activity_type: string;
  grouping: 'individual' | 'pair' | 'small_group' | 'whole_class'; difficulty: ContentDifficulty; estimated_minutes: number | null;
  resource_id: string | null; sort_order: number;
};
export type LearningAssessmentRow = {
  id: string; curriculum_version_id: string; grade_subject_id: string; topic_id: string; lesson_id: string | null; title: string;
  purpose: 'diagnostic' | 'formative' | 'summative_check'; difficulty: ContentDifficulty; estimated_minutes: number | null;
  mastery_percent: number; support_below_percent: number; language: string; status: ContentStatus;
  origin: 'authored' | 'ai_draft'; ai_disclosure: string | null; created_at: string; updated_at: string;
};
export type AssessmentObjectiveRow = { assessment_id: string; objective_id: string; curriculum_version_id: string };
export type AssessmentQuestionRow = {
  id: string; assessment_id: string; curriculum_version_id: string; position: number;
  question_type: 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer'; prompt: string; options: Json; marks: number; objective_id: string | null;
};
export type AssessmentQuestionKeyRow = {
  question_id: string; assessment_id: string; answer: Json; feedback: string | null; marking_notes: string | null;
};
export type SchoolCurriculumAdoptionRow = {
  id: string; school_id: string; curriculum_version_id: string; status: 'active' | 'ended'; adopted_at: string; ended_at: string | null;
};
export type SchoolGradeCurriculumMapRow = {
  id: string; school_id: string; school_grade_id: string; curriculum_version_id: string; curriculum_grade_id: string; created_at: string;
};
export type SchoolGradeCurriculumMapInsert = Pick<SchoolGradeCurriculumMapRow, 'school_id' | 'school_grade_id' | 'curriculum_version_id' | 'curriculum_grade_id'>;
export type SchoolSubjectCurriculumMapRow = {
  id: string; school_id: string; school_subject_id: string; curriculum_version_id: string; curriculum_subject_id: string; created_at: string;
};
export type SchoolSubjectCurriculumMapInsert = Pick<SchoolSubjectCurriculumMapRow, 'school_id' | 'school_subject_id' | 'curriculum_version_id' | 'curriculum_subject_id'>;
export type ClassTopicPlanRow = {
  id: string; school_id: string; class_id: string; school_subject_id: string; curriculum_version_id: string; topic_id: string;
  status: 'planned' | 'in_progress' | 'completed'; started_on: string | null; completed_on: string | null;
};
export type ClassLearningAssignmentRow = {
  id: string; school_id: string; class_id: string; school_subject_id: string; lesson_id: string | null; activity_id: string | null;
  assessment_id: string | null; title: string; instructions: string | null; due_at: string | null; status: 'assigned' | 'closed'; created_at: string;
};
export type LearningAttemptRow = {
  id: string; school_id: string; learner_id: string; class_id: string | null; assessment_id: string | null; activity_id: string | null;
  lesson_id: string | null; attempt_number: number; score: number | null; max_score: number | null; percent: number | null;
  completed: boolean; created_at: string;
};
export type LearnerObjectiveProgressRow = {
  id: string; school_id: string; learner_id: string; objective_id: string; status: LearnerProgressStatus; evidence_count: number;
  latest_percent: number | null; best_percent: number | null; last_evidence_at: string | null; mastered_at: string | null;
};
export type LearningRecommendationRow = {
  id: string; school_id: string; learner_id: string; objective_id: string; kind: 'remediation' | 'extension' | 'reassess';
  resource_id: string | null; reason: string; evidence: Json; status: 'open' | 'accepted' | 'dismissed' | 'completed';
  intervention_id: string | null; created_at: string; resolved_at: string | null;
};
export type ClassObjectiveProgressRow = {
  learner_id: string; first_name: string; last_name: string; learner_number: string; status: LearnerProgressStatus;
  latest_percent: number | null; evidence_count: number; last_evidence_at: string | null;
};

// ---------------------------------------------------------------------------
// AI-assisted authoring (20261002090000)
// ---------------------------------------------------------------------------
export type ContentVerificationStatus = 'unverified' | 'source_backed' | 'reviewed' | 'verified';
export type AiGenerationStatus = 'generating' | 'draft_created' | 'rejected_output' | 'failed';
export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ContentEntityTable = 'lessons' | 'teaching_resources' | 'learning_assessments';
export type ValidationCategory = 'structure' | 'curriculum' | 'delivery' | 'assessment' | 'safety';

export type CurriculumSourceRow = {
  id: string; title: string; publisher: string; doc_type: 'caps_policy' | 'annual_teaching_plan' | 'assessment_guideline' | 'textbook' | 'other';
  url: string | null; edition: string | null; licence: string; excerpts_permitted: boolean; checksum_sha256: string | null;
  retrieved_on: string | null; status: 'registered' | 'verified' | 'retired'; note: string | null; verified_at: string | null; created_at: string;
};
export type ContentSourceReferenceRow = {
  id: string; entity_table: ContentEntityTable; entity_id: string; source_id: string; locator: string; supports: string | null;
  check_result: 'matches' | 'partial' | 'does_not_match' | null; check_note: string | null; checked_at: string | null; created_at: string;
};
export type ContentVerificationRow = {
  entity_table: ContentEntityTable; entity_id: string; status: ContentVerificationStatus; fingerprint: string | null; note: string | null; set_at: string;
};
export type AiGenerationRequestRow = {
  id: string; requested_by: string | null; curriculum_version_id: string; grade_subject_id: string; topic_id: string; objective_ids: string[];
  kind: 'lesson_pack'; language: string; instruction: string | null; status: AiGenerationStatus; provider: string; model: string;
  prompt_version: string; schema_version: string; params: Json; output_hash: string | null; rejection_reasons: Json | null;
  result_lesson_id: string | null; created_at: string; completed_at: string | null;
};
export type AiGenerationOutputRow = { request_id: string; entity_table: ContentEntityTable; entity_id: string };
export type ContentValidationRunRow = {
  id: string; entity_table: ContentEntityTable; entity_id: string; ruleset_version: string; content_fingerprint: string;
  error_count: number; warning_count: number; info_count: number; passed: boolean; created_at: string;
};
export type ContentValidationFindingRow = {
  id: string; run_id: string; severity: ValidationSeverity; category: ValidationCategory; code: string; message: string; path: string | null;
  acknowledged_at: string | null; ack_note: string | null;
};
/** What content_provenance() returns: where a unit came from, what was checked and who approved it. */
export type ContentProvenance = {
  entity: ContentEntityTable; id: string; origin: 'authored' | 'ai_draft'; status: ContentStatus; ai_disclosure: string | null;
  created_by: { id: string; name: string } | null; created_at: string; reviewed_by: string | null; approved_by: string | null;
  approved_at: string | null; published_at: string | null;
  generation: {
    request_id: string; requested_by: string | null; requested_at: string; provider: string; model: string; prompt_version: string;
    schema_version: string; curriculum_version_id: string; topic_id: string; instruction: string | null; output_hash: string | null;
    objectives: Array<{ code: string; description: string }> | null;
  } | null;
  sources: Array<{
    reference_id: string; locator: string; supports: string | null; check_result: 'matches' | 'partial' | 'does_not_match' | null; checked_at: string | null;
    source: { id: string; title: string; publisher: string; doc_type: string; licence: string; status: string };
  }>;
  verification: { status: ContentVerificationStatus; recorded_status: ContentVerificationStatus | null; stale: boolean; set_at: string | null; note: string | null };
  validation: {
    run_id: string; run_at: string; passed: boolean; stale: boolean; errors: number; warnings: number; info: number; unacknowledged_warnings: number;
  } | null;
  review_events: Array<{ from: ContentStatus | null; to: ContentStatus; at: string; note: string | null; by: string | null }>;
};

type RpcWrittenTable<Row> = { Row: Row; Insert: never; Update: never };

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

      transport_vehicles: { Row: TransportVehicleRow; Insert: TransportVehicleInsert; Update: TransportVehicleUpdate; };
      transport_drivers: { Row: TransportDriverRow; Insert: TransportDriverInsert; Update: TransportDriverUpdate; };
      transport_routes: { Row: TransportRouteRow; Insert: TransportRouteInsert; Update: TransportRouteUpdate; };
      transport_stops: { Row: TransportStopRow; Insert: TransportStopInsert; Update: TransportStopUpdate; };
      transport_route_stops: { Row: TransportRouteStopRow; Insert: TransportRouteStopInsert; Update: TransportRouteStopUpdate; };
      transport_assignments: { Row: TransportAssignmentRow; Insert: TransportAssignmentInsert; Update: TransportAssignmentUpdate; };
      transport_schedules: { Row: TransportScheduleRow; Insert: TransportScheduleInsert; Update: TransportScheduleUpdate; };
      transport_attendance: { Row: TransportAttendanceRow; Insert: TransportAttendanceInsert; Update: TransportAttendanceUpdate; };
      school_compliance_settings: RpcWrittenTable<SchoolComplianceSettingsRow>;
      parental_consents: RpcWrittenTable<ParentalConsentRow>;
      student_record_access_log: RpcWrittenTable<StudentRecordAccessLogRow>;
      record_amendment_requests: RpcWrittenTable<RecordAmendmentRequestRow>;
      record_disclosures: RpcWrittenTable<RecordDisclosureRow>;
      content_safety_rules: RpcWrittenTable<ContentSafetyRuleRow>;
      content_safety_events: RpcWrittenTable<ContentSafetyEventRow>;
      data_subject_requests: RpcWrittenTable<DataSubjectRequestRow>;
      curriculum_versions: RpcWrittenTable<CurriculumVersionRow>;
      curriculum_grades: RpcWrittenTable<CurriculumGradeRow>;
      curriculum_subjects: RpcWrittenTable<CurriculumSubjectRow>;
      curriculum_grade_subjects: RpcWrittenTable<CurriculumGradeSubjectRow>;
      curriculum_terms: RpcWrittenTable<CurriculumTermRow>;
      curriculum_topics: RpcWrittenTable<CurriculumTopicRow>;
      curriculum_objectives: RpcWrittenTable<CurriculumObjectiveRow>;
      lessons: RpcWrittenTable<LessonRow>;
      lesson_objectives: RpcWrittenTable<LessonObjectiveRow>;
      teaching_resources: RpcWrittenTable<TeachingResourceRow>;
      lesson_resources: RpcWrittenTable<LessonResourceRow>;
      resource_objectives: RpcWrittenTable<ResourceObjectiveRow>;
      learning_activities: RpcWrittenTable<LearningActivityRow>;
      learning_assessments: RpcWrittenTable<LearningAssessmentRow>;
      assessment_objectives: RpcWrittenTable<AssessmentObjectiveRow>;
      assessment_questions: RpcWrittenTable<AssessmentQuestionRow>;
      assessment_question_keys: RpcWrittenTable<AssessmentQuestionKeyRow>;
      school_curriculum_adoptions: RpcWrittenTable<SchoolCurriculumAdoptionRow>;
      school_grade_curriculum_map: { Row: SchoolGradeCurriculumMapRow; Insert: SchoolGradeCurriculumMapInsert; Update: Partial<SchoolGradeCurriculumMapInsert>; };
      school_subject_curriculum_map: { Row: SchoolSubjectCurriculumMapRow; Insert: SchoolSubjectCurriculumMapInsert; Update: Partial<SchoolSubjectCurriculumMapInsert>; };
      class_topic_plans: RpcWrittenTable<ClassTopicPlanRow>;
      class_learning_assignments: RpcWrittenTable<ClassLearningAssignmentRow>;
      learning_attempts: RpcWrittenTable<LearningAttemptRow>;
      learner_objective_progress: RpcWrittenTable<LearnerObjectiveProgressRow>;
      learning_recommendations: RpcWrittenTable<LearningRecommendationRow>;
      curriculum_sources: RpcWrittenTable<CurriculumSourceRow>;
      content_source_references: RpcWrittenTable<ContentSourceReferenceRow>;
      content_verifications: RpcWrittenTable<ContentVerificationRow>;
      ai_generation_requests: RpcWrittenTable<AiGenerationRequestRow>;
      ai_generation_outputs: RpcWrittenTable<AiGenerationOutputRow>;
      content_validation_runs: RpcWrittenTable<ContentValidationRunRow>;
      content_validation_findings: RpcWrittenTable<ContentValidationFindingRow>;

    };
    Views: Record<string, never>;
    Functions: {
      create_transport_assignment: {
        Args: { p_school_id: string; p_learner_id: string; p_route_id: string; p_pickup_stop_id?: string | null; p_dropoff_stop_id?: string | null; p_effective_from?: string; p_effective_to?: string | null; p_notes?: string | null };
        Returns: TransportAssignmentRow;
      };
      list_transport_learners: {
        Args: { p_school_id: string };
        Returns: { id: string; learner_number: string; first_name: string; last_name: string }[];
      };
      get_transport_roster: {
        Args: { p_schedule_id: string };
        Returns: { learner_id: string; learner_number: string; first_name: string; last_name: string; pickup_stop_id: string | null; dropoff_stop_id: string | null; attendance_status: TransportAttendanceStatus | null; recorded_at: string | null }[];
      };
      add_transport_route_stop: {
        Args: { p_route_id: string; p_stop_id: string; p_stop_order: number; p_pickup_time?: string | null; p_dropoff_time?: string | null };
        Returns: TransportRouteStopRow;
      };
      create_transport_charge: {
        Args: { p_learner_id: string; p_fee_structure_id: string; p_due_date?: string | null; p_notes?: string | null };
        Returns: Json;
      };
      create_operation_record: {
        Args: { p_entity: string; p_school_id: string; p_payload: Json };
        Returns: Json;
      };
      library_checkout: {
        Args: { p_school_id: string; p_copy_id: string; p_learner_id: string; p_due_at: string };
        Returns: Json;
      };
      library_return: {
        Args: { p_loan_id: string };
        Returns: Json;
      };
      transition_purchase_request: {
        Args: { p_request_id: string; p_status: string };
        Returns: Json;
      };
      set_event_participation: {
        Args: { p_participant_id: string; p_status: string };
        Returns: Json;
      };
      create_data_subject_request: {
        Args: { p_school_id: string; p_subject_profile_id?: string | null; p_subject_learner_id?: string | null; p_request_type?: string; p_reason?: string | null };
        Returns: Json;
      };
      transition_data_subject_request: {
        Args: { p_request_id: string; p_status: string; p_outcome?: string | null };
        Returns: Json;
      };
      get_operations_analytics: {
        Args: { p_school_id: string };
        Returns: Json;
      };
      create_interop_import: {
        Args: { p_school_id: string; p_entity_type: string; p_file_name: string; p_format: string; p_rows: Json; p_mapping?: Json };
        Returns: Json;
      };
      validate_interop_import: {
        Args: { p_import_id: string };
        Returns: Json;
      };
      apply_interop_import: {
        Args: { p_import_id: string };
        Returns: Json;
      };
      get_advanced_analytics: {
        Args: { p_school_id: string };
        Returns: Json;
      };
      get_operations_workspace: {
        Args: { p_school_id: string };
        Returns: Json;
      };
      export_data_subject_package: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      boarding_allocate_learner: {
        Args: { p_school_id: string; p_learner_id: string; p_bed_id: string; p_effective_from?: string; p_notes?: string | null };
        Returns: Json;
      };
      boarding_record_attendance: {
        Args: { p_school_id: string; p_learner_id: string; p_date: string; p_status: string };
        Returns: Json;
      };
      boarding_transition_leave: {
        Args: { p_leave_id: string; p_status: string };
        Returns: Json;
      };
      library_reserve: {
        Args: { p_school_id: string; p_book_id: string; p_learner_id: string };
        Returns: Json;
      };
      library_renew: {
        Args: { p_loan_id: string; p_due_at: string };
        Returns: Json;
      };
      sports_add_player: {
        Args: { p_school_id: string; p_team_id: string; p_learner_id: string };
        Returns: Json;
      };
      sports_record_fixture_result: {
        Args: { p_fixture_id: string; p_status: string; p_score_for?: number | null; p_score_against?: number | null };
        Returns: Json;
      };
      asset_transfer: {
        Args: { p_asset_id: string; p_to_location: string; p_to_profile_id?: string | null; p_reason?: string | null };
        Returns: Json;
      };
      asset_set_lifecycle: {
        Args: { p_asset_id: string; p_status: string; p_condition?: string | null };
        Returns: Json;
      };
      create_purchase_request: {
        Args: { p_school_id: string; p_description: string; p_estimated_amount: number };
        Returns: Json;
      };
      add_purchase_request_item: {
        Args: { p_request_id: string; p_description: string; p_quantity: number; p_unit_cost: number };
        Returns: Json;
      };
      create_purchase_order: {
        Args: { p_school_id: string; p_request_id: string; p_supplier_id: string; p_po_number: string; p_total_amount: number };
        Returns: Json;
      };
      record_goods_receipt: {
        Args: { p_purchase_order_id: string; p_notes?: string | null };
        Returns: Json;
      };
      transition_supplier_invoice: {
        Args: { p_invoice_id: string; p_status: string };
        Returns: Json;
      };
      create_governance_meeting: {
        Args: { p_school_id: string; p_title: string; p_meeting_date: string; p_location?: string | null };
        Returns: Json;
      };
      create_governance_resolution: {
        Args: { p_school_id: string; p_meeting_id: string; p_title: string; p_decision: string; p_due_date?: string | null };
        Returns: Json;
      };
      create_school_event: {
        Args: { p_school_id: string; p_title: string; p_event_type: string; p_starts_at: string; p_ends_at: string; p_venue?: string | null; p_description?: string | null };
        Returns: Json;
      };
      create_event_participant: {
        Args: { p_event_id: string; p_profile_id?: string | null; p_learner_id?: string | null };
        Returns: Json;
      };
      save_analytics_view: {
        Args: { p_school_id: string; p_name: string; p_report_key: string; p_filters?: Json };
        Returns: Json;
      };
      set_automation_job: {
        Args: { p_school_id: string; p_job_key: string; p_cron_expression: string; p_enabled: boolean };
        Returns: Json;
      };

      create_transport_schedule: {
        Args: { p_school_id: string; p_route_id: string; p_vehicle_id: string; p_driver_id?: string | null; p_service_date?: string; p_departure_time?: string | null; p_notes?: string | null };
        Returns: TransportScheduleRow;
      };
      set_transport_assignment_status: {
        Args: { p_assignment_id: string; p_status: TransportAssignmentStatus };
        Returns: TransportAssignmentRow;
      };
      record_transport_attendance: {
        Args: { p_schedule_id: string; p_learner_id: string; p_status: TransportAttendanceStatus; p_notes?: string | null };
        Returns: TransportAttendanceRow;
      };
      set_transport_trip_status: {
        Args: { p_schedule_id: string; p_status: TransportTripStatus };
        Returns: TransportScheduleRow;
      };
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
      provision_learner_login: {
        Args: { p_learner_id: string; p_email: string; p_phone?: string | null };
        Returns: { user_id: string; temporary_password: string }[];
      };
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
      record_parental_consent: {
        Args: {
          p_learner_id: string;
          p_purpose: ConsentPurpose;
          p_decision: ConsentDecision;
          p_attested_name?: string | null;
          p_method?: ConsentMethod;
        };
        Returns: ParentalConsentRow;
      };
      log_learner_record_access: {
        Args: { p_learner_id: string; p_access_type: 'view' | 'export' | 'print'; p_context: string };
        Returns: undefined;
      };
      submit_record_amendment: {
        Args: {
          p_learner_id: string;
          p_record_area: AmendmentRecordArea;
          p_requested_change: string;
          p_reason: string;
          p_record_reference?: string | null;
          p_current_value?: string | null;
        };
        Returns: RecordAmendmentRequestRow;
      };
      decide_record_amendment: {
        Args: {
          p_request_id: string;
          p_status: 'under_review' | 'approved' | 'denied' | 'closed';
          p_decision_notes: string | null;
        };
        Returns: RecordAmendmentRequestRow;
      };
      respond_to_amendment_denial: {
        Args: { p_request_id: string; p_request_hearing: boolean; p_disagreement_statement?: string | null };
        Returns: RecordAmendmentRequestRow;
      };
      record_disclosure: {
        Args: {
          p_learner_id: string;
          p_disclosed_to: string;
          p_recipient_type: DisclosureRecipientType;
          p_legal_basis: string;
          p_data_categories: string[];
        };
        Returns: RecordDisclosureRow;
      };
      get_learner_record_package: { Args: { p_learner_id: string }; Returns: Json };
      get_learner_privacy_history: { Args: { p_learner_id: string }; Returns: Json };
      execute_learner_erasure: { Args: { p_request_id: string; p_confirm_learner_number: string }; Returns: Json };
      review_content_safety_event: {
        Args: { p_event_id: string; p_status: Exclude<ContentSafetyEventStatus, 'open'>; p_notes?: string | null };
        Returns: ContentSafetyEventRow;
      };
      upsert_content_safety_rule: {
        Args: {
          p_school_id: string | null;
          p_category: ContentSafetyCategory;
          p_pattern: string;
          p_action: 'block' | 'flag';
          p_description?: string | null;
          p_active?: boolean;
          p_rule_id?: string | null;
        };
        Returns: ContentSafetyRuleRow;
      };
      get_compliance_overview: { Args: { p_school_id: string }; Returns: Json };
      update_compliance_settings: {
        Args: {
          p_school_id: string;
          p_frameworks: ComplianceFramework[];
          p_coppa_consent_age: number;
          p_gdpr_digital_consent_age: number;
          p_ferpa_amendment_response_days: number;
          p_dsar_response_days: number;
          p_content_filter_enabled: boolean;
          p_information_officer_name: string | null;
          p_information_officer_email: string | null;
          p_privacy_notice_version: string;
        };
        Returns: SchoolComplianceSettingsRow;
      };
      get_my_privacy_overview: { Args: Record<string, never>; Returns: Json };
      adopt_curriculum_version: { Args: { p_school_id: string; p_version_id: string }; Returns: string };
      set_class_current_topic: { Args: { p_class_id: string; p_school_subject_id: string; p_topic_id: string }; Returns: string };
      assign_learning_to_class: {
        Args: {
          p_class_id: string; p_school_subject_id: string; p_lesson_id?: string | null; p_activity_id?: string | null;
          p_assessment_id?: string | null; p_title?: string | null; p_instructions?: string | null; p_due_at?: string | null;
        };
        Returns: string;
      };
      record_learning_attempt: {
        Args: {
          p_learner_id: string; p_assessment_id?: string | null; p_activity_id?: string | null; p_score?: number | null;
          p_max_score?: number | null; p_completed?: boolean; p_responses?: Json; p_assignment_id?: string | null;
        };
        Returns: LearningAttemptRow;
      };
      class_objective_progress: { Args: { p_class_id: string; p_objective_id: string }; Returns: ClassObjectiveProgressRow[] };
      generate_learning_recommendations: { Args: { p_class_id: string; p_objective_id: string }; Returns: number };
      update_recommendation_status: { Args: { p_id: string; p_status: 'accepted' | 'dismissed' | 'completed'; p_intervention_id?: string | null }; Returns: undefined };
      content_transition: { Args: { p_entity: string; p_id: string; p_to: ContentStatus; p_note?: string | null }; Returns: undefined };
      register_curriculum_source: {
        Args: {
          p_title: string; p_publisher: string; p_doc_type: CurriculumSourceRow['doc_type']; p_licence: string; p_url?: string | null;
          p_edition?: string | null; p_excerpts_permitted?: boolean; p_checksum_sha256?: string | null; p_retrieved_on?: string | null; p_note?: string | null;
        };
        Returns: string;
      };
      verify_curriculum_source: { Args: { p_source_id: string; p_note?: string | null }; Returns: undefined };
      add_content_source_reference: { Args: { p_entity: ContentEntityTable; p_id: string; p_source_id: string; p_locator: string; p_supports?: string | null }; Returns: string };
      check_content_source_reference: { Args: { p_reference_id: string; p_result: 'matches' | 'partial' | 'does_not_match'; p_note?: string | null }; Returns: undefined };
      set_content_verification: { Args: { p_entity: ContentEntityTable; p_id: string; p_status: ContentVerificationStatus; p_note?: string | null }; Returns: undefined };
      validate_content: { Args: { p_entity: ContentEntityTable; p_id: string }; Returns: string };
      acknowledge_validation_finding: { Args: { p_finding_id: string; p_note: string }; Returns: undefined };
      content_provenance: { Args: { p_entity: ContentEntityTable; p_id: string }; Returns: ContentProvenance };
    };
  };
};
