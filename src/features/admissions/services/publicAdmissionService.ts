import { supabase } from '@/lib/supabase';

/**
 * Client for the `admissions-public` Edge Function — the only way a
 * prospective family (with no account) reaches the admissions tables.
 * Every call is unauthenticated; the function uses the service-role key
 * server-side and scopes each action by the secret resume token or by
 * email + reference number.
 */

export interface PublicAdmissionConfig {
  school: { id: string; name: string };
  academicYears: { id: string; name: string; start_date: string; is_active: boolean }[];
  grades: { id: string; name: string; sort_order: number }[];
  requirements: { id: string; label: string; description: string | null; required: boolean; grade_id: string | null }[];
}

export interface PublicApplicationPayload {
  applicant_first_name?: string;
  applicant_last_name?: string;
  applicant_phone?: string;
  applicant_relationship?: string;
  learner_first_name?: string;
  learner_last_name?: string;
  learner_date_of_birth?: string;
  learner_gender?: string;
  learner_id_number?: string;
  learner_nationality?: string;
  learner_home_language?: string;
  prior_school?: string;
  additional_notes?: string;
  academic_year_id?: string;
  requested_grade_id?: string;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { error?: string }>('admissions-public', { body });
  if (error) throw new Error('Could not reach the admissions service. Please try again.');
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export const publicAdmissionService = {
  config: (schoolId: string) => invoke<PublicAdmissionConfig>({ action: 'config', schoolId }),

  start: (schoolId: string, applicantEmail: string, payload: PublicApplicationPayload) =>
    invoke<{ applicationId: string; resumeToken: string }>({ action: 'start', schoolId, applicantEmail, payload }),

  get: (resumeToken: string) =>
    invoke<{ found: boolean; editable?: boolean; status?: string; application?: Record<string, unknown> }>({ action: 'get', resumeToken }),

  save: (resumeToken: string, payload: PublicApplicationPayload) =>
    invoke<{ ok: true }>({ action: 'save', resumeToken, payload }),

  submit: (resumeToken: string) => invoke<{ referenceNumber: string }>({ action: 'submit', resumeToken }),

  resume: (email: string, reference: string) =>
    invoke<{
      found: boolean;
      status?: string;
      reference_number?: string;
      resume_token?: string | null;
      application?: Record<string, unknown>;
    }>({ action: 'resume', email, reference }),

  async uploadDocument(resumeToken: string, file: File, label: string, requirementId?: string): Promise<void> {
    const { uploadUrl, path } = await invoke<{ uploadUrl: string; path: string; token: string }>({
      action: 'upload-url',
      resumeToken,
      fileName: file.name,
      mimeType: file.type,
    });
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
    if (!put.ok) throw new Error('The file upload failed. Please try again.');
    await invoke({
      action: 'register-doc',
      resumeToken,
      label,
      path,
      mimeType: file.type,
      sizeBytes: file.size,
      requirementId: requirementId ?? null,
    });
  },
};
