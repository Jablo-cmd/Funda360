import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/pagination';
import type {
  AdmissionApplicationRow,
  AdmissionApplicationEventRow,
  AdmissionApplicationDocumentRow,
  AdmissionDocumentRequirementRow,
  AdmissionApplicationStatus,
} from '@/lib/database.types';
import type {
  AdmissionApplication,
  AdmissionApplicationEvent,
  AdmissionApplicationDocument,
  AdmissionDocumentRequirement,
  AdmissionApplicationWithDetail,
} from '@/features/admissions/types/admission.types';

function toApplication(row: AdmissionApplicationRow): AdmissionApplication {
  return {
    id: row.id,
    schoolId: row.school_id,
    academicYearId: row.academic_year_id,
    requestedGradeId: row.requested_grade_id,
    referenceNumber: row.reference_number,
    status: row.status,
    applicantFirstName: row.applicant_first_name,
    applicantLastName: row.applicant_last_name,
    applicantEmail: row.applicant_email,
    applicantPhone: row.applicant_phone,
    applicantRelationship: row.applicant_relationship,
    learnerFirstName: row.learner_first_name,
    learnerLastName: row.learner_last_name,
    learnerDateOfBirth: row.learner_date_of_birth,
    learnerGender: row.learner_gender,
    learnerIdNumber: row.learner_id_number,
    learnerNationality: row.learner_nationality,
    learnerHomeLanguage: row.learner_home_language,
    priorSchool: row.prior_school,
    additionalNotes: row.additional_notes,
    interviewAt: row.interview_at,
    assessmentAt: row.assessment_at,
    decisionAt: row.decision_at,
    decisionReason: row.decision_reason,
    convertedLearnerId: row.converted_learner_id,
    submittedAt: row.submitted_at,
    isPublicSubmission: row.is_public_submission,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: AdmissionApplicationEventRow): AdmissionApplicationEvent {
  return {
    id: row.id,
    applicationId: row.application_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    actorProfileId: row.actor_profile_id,
    createdAt: row.created_at,
  };
}

function toDocument(row: AdmissionApplicationDocumentRow): AdmissionApplicationDocument {
  return {
    id: row.id,
    applicationId: row.application_id,
    schoolId: row.school_id,
    requirementId: row.requirement_id,
    label: row.label,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    verified: row.verified,
    uploadedAt: row.uploaded_at,
  };
}

function toRequirement(row: AdmissionDocumentRequirementRow): AdmissionDocumentRequirement {
  return {
    id: row.id,
    schoolId: row.school_id,
    gradeId: row.grade_id,
    label: row.label,
    description: row.description,
    required: row.required,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

async function listApplications(
  schoolId: string,
  filters: { status?: string; gradeId?: string; academicYearId?: string } = {},
): Promise<AdmissionApplication[]> {
  const rows = await fetchAllRows<AdmissionApplicationRow>((from, to) => {
    let q = supabase.from('admission_applications').select('*').eq('school_id', schoolId);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.gradeId) q = q.eq('requested_grade_id', filters.gradeId);
    if (filters.academicYearId) q = q.eq('academic_year_id', filters.academicYearId);
    return q.order('created_at', { ascending: false }).range(from, to);
  });
  return rows.map(toApplication);
}

async function getApplication(id: string): Promise<AdmissionApplicationWithDetail | null> {
  const { data, error } = await supabase.from('admission_applications').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [{ data: events, error: eErr }, { data: docs, error: dErr }] = await Promise.all([
    supabase.from('admission_application_events').select('*').eq('application_id', id).order('created_at', { ascending: true }),
    supabase.from('admission_application_documents').select('*').eq('application_id', id).order('uploaded_at', { ascending: true }),
  ]);
  if (eErr) throw eErr;
  if (dErr) throw dErr;
  return { ...toApplication(data), events: events.map(toEvent), documents: docs.map(toDocument) };
}

export interface CreateApplicationInput {
  applicantEmail: string;
  applicantFirstName: string;
  applicantLastName: string;
  learnerFirstName: string;
  learnerLastName: string;
  academicYearId?: string | null;
  requestedGradeId?: string | null;
  applicantPhone?: string | null;
  applicantRelationship?: string | null;
  learnerDateOfBirth?: string | null;
}

async function createApplication(schoolId: string, input: CreateApplicationInput): Promise<AdmissionApplication> {
  const { data, error } = await supabase.rpc('create_admission_application', {
    p_school_id: schoolId,
    p_applicant_email: input.applicantEmail,
    p_applicant_first_name: input.applicantFirstName,
    p_applicant_last_name: input.applicantLastName,
    p_learner_first_name: input.learnerFirstName,
    p_learner_last_name: input.learnerLastName,
    p_academic_year_id: input.academicYearId ?? null,
    p_requested_grade_id: input.requestedGradeId ?? null,
    p_applicant_phone: input.applicantPhone ?? null,
    p_applicant_relationship: input.applicantRelationship ?? null,
    p_learner_date_of_birth: input.learnerDateOfBirth ?? null,
  });
  if (error) throw error;
  return toApplication(data);
}

/** Edits the free-text data on a pre-decision application (RLS + the protect trigger gate what may change). */
async function updateApplicationData(id: string, patch: Record<string, unknown>): Promise<AdmissionApplication> {
  const { data, error } = await supabase.from('admission_applications').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return toApplication(data);
}

async function submit(id: string): Promise<AdmissionApplication> {
  const { data, error } = await supabase.rpc('submit_admission_application', { p_application_id: id });
  if (error) throw error;
  return toApplication(data);
}

async function transition(id: string, to: AdmissionApplicationStatus, note?: string): Promise<AdmissionApplication> {
  const { data, error } = await supabase.rpc('transition_admission_application', {
    p_application_id: id,
    p_to: to,
    p_note: note ?? null,
  });
  if (error) throw error;
  return toApplication(data);
}

async function addNote(id: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('add_admission_application_note', { p_application_id: id, p_note: note });
  if (error) throw error;
}

async function convert(id: string, classId: string | null, provisionGuardianAccount: boolean): Promise<AdmissionApplication> {
  const { data, error } = await supabase.rpc('convert_admission_application', {
    p_application_id: id,
    p_class_id: classId,
    p_provision_guardian_account: provisionGuardianAccount,
  });
  if (error) throw error;
  return toApplication(data);
}

async function verifyDocument(id: string, verified: boolean): Promise<void> {
  const { error } = await supabase
    .from('admission_application_documents')
    .update({ verified, verified_at: verified ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

async function documentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('admission-documents').createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

// --- Document requirements ---

async function listRequirements(schoolId: string): Promise<AdmissionDocumentRequirement[]> {
  const { data, error } = await supabase
    .from('admission_document_requirements')
    .select('*')
    .eq('school_id', schoolId)
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data.map(toRequirement);
}

async function createRequirement(
  schoolId: string,
  input: { label: string; description?: string | null; gradeId?: string | null; required: boolean },
): Promise<AdmissionDocumentRequirement> {
  const { data, error } = await supabase
    .from('admission_document_requirements')
    .insert({
      school_id: schoolId,
      label: input.label,
      description: input.description || null,
      grade_id: input.gradeId || null,
      required: input.required,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toRequirement(data);
}

async function archiveRequirement(id: string): Promise<void> {
  const { error } = await supabase.from('admission_document_requirements').update({ active: false }).eq('id', id);
  if (error) throw error;
}

export const admissionService = {
  listApplications,
  getApplication,
  createApplication,
  updateApplicationData,
  submit,
  transition,
  addNote,
  convert,
  verifyDocument,
  documentUrl,
  listRequirements,
  createRequirement,
  archiveRequirement,
};
