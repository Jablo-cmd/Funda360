import type { EducationAreaLevel } from '@/lib/database.types';

/**
 * Shapes returned by the reporting RPCs in
 * 20261009091000_government_reporting.sql. Every figure is computed in the
 * database from source tables; a null rate means there was nothing to
 * compute it from (or, where `suppressed` is true, the group was too small
 * to show without learner-level access).
 */

export type ReportingCallerKind = 'platform' | 'official' | 'school';

export interface ReportingArea {
  id: string;
  level: EducationAreaLevel;
  parent_id: string | null;
  name: string;
  code: string | null;
}

export interface ReportingScopeSchool {
  id: string;
  name: string;
  emis_number: string | null;
  education_area_id: string | null;
  status: string;
}

export interface ReportingScope {
  caller_kind: ReportingCallerKind;
  learner_detail: boolean;
  areas: ReportingArea[];
  schools: ReportingScopeSchool[];
  grades: string[];
  academic_years: string[];
  terms: number[];
}

/** Filter keys understood by get_government_report(). Empty strings are treated as "not set". */
export interface GovernmentReportFilters {
  province_id?: string;
  district_id?: string;
  circuit_id?: string;
  school_id?: string;
  grade?: string;
  academic_year?: string;
  term?: string;
  start_date?: string;
  end_date?: string;
  attendance_threshold?: number;
  performance_threshold?: number;
}

export type AttentionReason = 'low_attendance' | 'low_performance' | 'overdue_interventions' | 'data_quality';

export interface DataQualityIssues {
  missing_emis_number?: boolean;
  not_linked_to_area?: boolean;
  no_academic_year?: boolean;
  period_not_configured?: boolean;
  learners_not_enrolled?: number;
  classes_without_attendance?: number;
  classes_without_assessments?: number;
  assessments_missing_marks?: number;
}

export interface InterventionCounts {
  open: number;
  in_progress: number;
  overdue: number;
  resolved: number;
}

export interface GovernmentSchoolRow {
  id: string;
  name: string;
  emis_number: string | null;
  status: string;
  province: string | null;
  district_id: string | null;
  district: string | null;
  circuit_id: string | null;
  circuit: string | null;
  academic_year: string | null;
  period_start: string | null;
  period_end: string | null;
  learners_active: number;
  learners_enrolled: number;
  educators: number;
  staff: number;
  classes: number;
  learner_educator_ratio: number | null;
  attendance_rate: number | null;
  attendance_records: number;
  average_percent: number | null;
  pass_rate: number | null;
  assessment_results: number;
  learners_requiring_intervention: number;
  interventions: InterventionCounts;
  data_quality: DataQualityIssues;
  attention: AttentionReason[];
  learner_detail: boolean;
}

export interface GovernmentReportSummary {
  schools: number;
  learners_active: number;
  learners_enrolled: number;
  educators: number;
  staff: number;
  classes: number;
  attendance_rate: number | null;
  attendance_records: number;
  average_percent: number | null;
  pass_rate: number | null;
  assessment_results: number;
  learners_requiring_intervention: number;
  schools_requiring_attention: number;
  schools_with_data_quality_issues: number;
  interventions: InterventionCounts;
}

export interface GovernmentAreaRow {
  district_id: string | null;
  district: string | null;
  province: string | null;
  schools: number;
  learners: number;
  educators: number;
  attendance_rate: number | null;
  average_percent: number | null;
  schools_requiring_attention: number;
}

export interface GovernmentGradeRow {
  grade: string;
  learners: number;
  schools: number;
  classes: number;
  suppressed: boolean;
  attendance_rate: number | null;
  average_percent: number | null;
  pass_rate: number | null;
  assessment_results: number;
}

export interface GovernmentSubjectRow {
  subject: string;
  schools: number;
  learners: number;
  assessment_results: number;
  suppressed: boolean;
  average_percent: number | null;
  pass_rate: number | null;
}

export interface AttendanceTrendPoint {
  period: string;
  attendance_rate: number | null;
  records: number;
}

export interface PerformanceTrendPoint {
  period: string;
  average_percent: number | null;
  results: number;
}

export interface GovernmentReport {
  generated_at: string;
  filters: GovernmentReportFilters;
  thresholds: { attendance: number; performance: number; minimum_group_size: number };
  summary: GovernmentReportSummary;
  schools: GovernmentSchoolRow[];
  areas: GovernmentAreaRow[];
  grades: GovernmentGradeRow[];
  subjects: GovernmentSubjectRow[];
  attendance_trend: AttendanceTrendPoint[];
  performance_trend: PerformanceTrendPoint[];
}

export interface SchoolReportClassRow {
  id: string;
  name: string;
  grade: string;
  learners: number;
  suppressed: boolean;
  attendance_rate: number | null;
  average_percent: number | null;
  pass_rate: number | null;
  learners_requiring_intervention: number | null;
  assessments: number;
  last_attendance_date: string | null;
}

export interface SchoolReport {
  generated_at: string;
  school: { id: string; name: string; emis_number: string | null; status: string; education_area_id: string | null };
  period: { academic_year: string | null; start: string | null; end: string | null } | null;
  learner_detail: boolean;
  thresholds: { attendance: number; performance: number; minimum_group_size: number };
  classes: SchoolReportClassRow[];
}

export interface ClassLearnerRow {
  id: string;
  learner_number: string | null;
  first_name: string;
  last_name: string;
  attendance_rate: number | null;
  absent_days: number;
  average_percent: number | null;
  assessment_results: number;
  open_interventions: number;
  overdue_interventions: number;
  requires_intervention: boolean;
}

export interface ClassLearnerReport {
  generated_at: string;
  class: { id: string; name: string; grade: string; school_id: string };
  thresholds: { attendance: number; performance: number };
  learners: ClassLearnerRow[];
}

export type ExportFormat = 'csv' | 'excel_csv' | 'pdf';
