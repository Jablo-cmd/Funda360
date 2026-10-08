import { supabase } from '@/lib/supabase';
import type { EducationAreaLevel, EducationAreaRow, EducationOfficialAssignmentRow, Json } from '@/lib/database.types';
import type {
  ClassLearnerReport,
  ExportFormat,
  GovernmentReport,
  GovernmentReportFilters,
  ReportingScope,
  SchoolReport,
} from '@/features/government/types/government.types';
import { compactFilters } from '@/features/government/utils/reportFilters';

/**
 * Every call goes through a SECURITY DEFINER function that works out the
 * caller's schools in the database and rejects anything outside them.
 * Nothing here filters for security; the filters only narrow.
 */

async function getScope(): Promise<ReportingScope> {
  const { data, error } = await supabase.rpc('get_reporting_scope');
  if (error) throw error;
  return data as unknown as ReportingScope;
}

async function getReport(filters: GovernmentReportFilters): Promise<GovernmentReport> {
  const { data, error } = await supabase.rpc('get_government_report', {
    p_filters: compactFilters(filters) as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as GovernmentReport;
}

async function getSchoolReport(schoolId: string, filters: GovernmentReportFilters): Promise<SchoolReport> {
  const { data, error } = await supabase.rpc('get_school_report', {
    p_school_id: schoolId,
    p_filters: compactFilters(filters) as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as SchoolReport;
}

async function getClassLearnerReport(classId: string, filters: GovernmentReportFilters): Promise<ClassLearnerReport> {
  const { data, error } = await supabase.rpc('get_class_learner_report', {
    p_class_id: classId,
    p_filters: compactFilters(filters) as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as ClassLearnerReport;
}

async function recordExport(report: string, format: ExportFormat, filters: GovernmentReportFilters): Promise<void> {
  const { error } = await supabase.rpc('record_government_report_export', {
    p_report: report,
    p_format: format,
    p_filters: compactFilters(filters) as unknown as Json,
  });
  if (error) throw error;
}

// --- Administration (platform administrators; enforced in the database) ---

export interface EducationOfficial {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

async function listAreas(): Promise<EducationAreaRow[]> {
  const { data, error } = await supabase.from('education_areas').select('*').order('name');
  if (error) throw error;
  return data;
}

async function saveArea(input: {
  id: string | null;
  level: EducationAreaLevel;
  parentId: string | null;
  name: string;
  code: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_education_area', {
    p_id: input.id,
    p_level: input.level,
    p_parent_id: input.parentId,
    p_name: input.name,
    p_code: input.code,
  });
  if (error) throw error;
  return data;
}

export interface SchoolAreaLink {
  id: string;
  name: string;
  emisNumber: string | null;
  province: string | null;
  district: string | null;
  educationAreaId: string | null;
}

/** Platform administrators can read every school (schools RLS); others get their own. */
async function listSchoolAreaLinks(): Promise<SchoolAreaLink[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, emis_number, province, district, education_area_id')
    .order('name');
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    emisNumber: row.emis_number,
    province: row.province,
    district: row.district,
    educationAreaId: row.education_area_id,
  }));
}

async function setSchoolArea(schoolId: string, areaId: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_school_education_area', { p_school_id: schoolId, p_area_id: areaId });
  if (error) throw error;
}

async function listOfficials(): Promise<EducationOfficial[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, status')
    .eq('role', 'education_official')
    .order('last_name');
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    status: row.status,
  }));
}

async function provisionOfficial(input: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}): Promise<{ userId: string; temporaryPassword: string }> {
  const { data, error } = await supabase.rpc('provision_education_official', {
    p_email: input.email,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
  });
  if (error) throw error;
  const row = data[0];
  if (!row) throw new Error('The account was not created.');
  return { userId: row.user_id, temporaryPassword: row.temporary_password };
}

async function listAssignments(): Promise<EducationOfficialAssignmentRow[]> {
  const { data, error } = await supabase
    .from('education_official_assignments')
    .select('*')
    .eq('active', true)
    .order('granted_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function grantAccess(profileId: string, areaId: string, learnerDetail: boolean): Promise<void> {
  const { error } = await supabase.rpc('grant_education_official_access', {
    p_profile_id: profileId,
    p_area_id: areaId,
    p_learner_detail: learnerDetail,
  });
  if (error) throw error;
}

async function revokeAccess(assignmentId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_education_official_access', { p_assignment_id: assignmentId });
  if (error) throw error;
}

export const governmentReportService = {
  getScope,
  getReport,
  getSchoolReport,
  getClassLearnerReport,
  recordExport,
  listAreas,
  saveArea,
  setSchoolArea,
  listSchoolAreaLinks,
  listOfficials,
  provisionOfficial,
  listAssignments,
  grantAccess,
  revokeAccess,
};
