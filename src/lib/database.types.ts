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
export type AttendanceStatus = 'present' | 'absent' | 'late';
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
  custody_notes?: string | null;
  active?: boolean;
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
  active?: boolean;
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
      class_teacher_assignments: {
        Row: ClassTeacherAssignmentRow;
        Insert: ClassTeacherAssignmentInsert;
        Update: ClassTeacherAssignmentUpdate;
      };
      attendance_records: {
        Row: AttendanceRecordRow;
        Insert: AttendanceRecordInsert;
        Update: AttendanceRecordUpdate;
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
    };
  };
};
