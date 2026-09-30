import { supabase } from '@/lib/supabase';
import type {
  AmendmentRecordArea,
  AuditLogRow,
  ComplianceFramework,
  ConsentDecision,
  ConsentMethod,
  ConsentPurpose,
  ContentSafetyCategory,
  ContentSafetyEventRow,
  ContentSafetyEventStatus,
  ContentSafetyRuleRow,
  DataSubjectRequestRow,
  DisclosureRecipientType,
  DsarRequestType,
  DsarStatus,
  ParentalConsentRow,
  RecordAmendmentRequestRow,
  RecordDisclosureRow,
  SchoolComplianceSettingsRow,
  StudentRecordAccessLogRow,
} from '@/lib/database.types';
import type {
  ComplianceOverview,
  LearnerRecordPackage,
  PrivacyHistory,
  PrivacyOverview,
} from '@/features/compliance/types/compliance.types';

/**
 * Every call here goes through RLS or a SECURITY DEFINER RPC defined in
 * 20260930100000_compliance_framework.sql — the database decides who may do
 * what; this layer only shapes requests and results.
 */

export const PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON RPC results are shape-checked before use: a malformed response fails as an error, never as a crashed page. */
function expectShape<T>(value: unknown, keys: string[], what: string): T {
  if (!isRecord(value) || keys.some((k) => !(k in value))) {
    throw new Error(`Unexpected response while loading ${what}.`);
  }
  return value as T;
}

export interface Page<T> {
  rows: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Overview + settings

export async function getComplianceOverview(schoolId: string): Promise<ComplianceOverview> {
  const { data, error } = await supabase.rpc('get_compliance_overview', { p_school_id: schoolId });
  if (error) throw error;
  return expectShape<ComplianceOverview>(
    data,
    ['settings', 'learners', 'dsar', 'amendments', 'rls'],
    'the compliance overview',
  );
}

export interface ComplianceSettingsInput {
  frameworks: ComplianceFramework[];
  coppaConsentAge: number;
  gdprDigitalConsentAge: number;
  ferpaAmendmentResponseDays: number;
  dsarResponseDays: number;
  contentFilterEnabled: boolean;
  informationOfficerName: string;
  informationOfficerEmail: string;
  privacyNoticeVersion: string;
}

export async function updateComplianceSettings(
  schoolId: string,
  input: ComplianceSettingsInput,
): Promise<SchoolComplianceSettingsRow> {
  const { data, error } = await supabase.rpc('update_compliance_settings', {
    p_school_id: schoolId,
    p_frameworks: input.frameworks,
    p_coppa_consent_age: input.coppaConsentAge,
    p_gdpr_digital_consent_age: input.gdprDigitalConsentAge,
    p_ferpa_amendment_response_days: input.ferpaAmendmentResponseDays,
    p_dsar_response_days: input.dsarResponseDays,
    p_content_filter_enabled: input.contentFilterEnabled,
    p_information_officer_name: input.informationOfficerName || null,
    p_information_officer_email: input.informationOfficerEmail || null,
    p_privacy_notice_version: input.privacyNoticeVersion,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Name lookups (staff views show people, not UUIDs)

export async function getProfileNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', unique);
  if (error) throw error;
  for (const p of data) names.set(p.id, `${p.first_name} ${p.last_name}`);
  return names;
}

export async function getLearnerNames(
  ids: string[],
): Promise<Map<string, { name: string; learnerNumber: string }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, { name: string; learnerNumber: string }>();
  if (unique.length === 0) return names;
  const { data, error } = await supabase
    .from('learners')
    .select('id, first_name, last_name, learner_number')
    .in('id', unique);
  if (error) throw error;
  for (const l of data)
    names.set(l.id, { name: `${l.first_name} ${l.last_name}`, learnerNumber: l.learner_number });
  return names;
}

export async function searchLearners(schoolId: string, term: string) {
  const q = term.trim();
  let query = supabase
    .from('learners')
    .select('id, first_name, last_name, learner_number')
    .eq('school_id', schoolId);
  if (q)
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,learner_number.ilike.%${q}%`);
  const { data, error } = await query.order('last_name').limit(20);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Data-subject requests + erasure

export async function listDataSubjectRequests(schoolId: string): Promise<DataSubjectRequestRow[]> {
  const { data, error } = await supabase
    .from('data_subject_requests')
    .select('*')
    .eq('school_id', schoolId)
    .order('requested_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function transitionDataSubjectRequest(
  requestId: string,
  status: DsarStatus,
  outcome: string | null,
) {
  const { error } = await supabase.rpc('transition_data_subject_request', {
    p_request_id: requestId,
    p_status: status,
    p_outcome: outcome,
  });
  if (error) throw error;
}

export interface ErasureResult {
  learner_id: string;
  summary: Record<string, number>;
  storage: Record<'learner-documents' | 'assignment-files', string[]>;
  filesRemoved: number;
  filesFailed: number;
}

/** Executes the erasure, then removes the returned files through the Storage API (SQL cannot delete stored objects). */
export async function executeLearnerErasure(
  requestId: string,
  confirmLearnerNumber: string,
): Promise<ErasureResult> {
  const { data, error } = await supabase.rpc('execute_learner_erasure', {
    p_request_id: requestId,
    p_confirm_learner_number: confirmLearnerNumber,
  });
  if (error) throw error;
  const result = expectShape<Omit<ErasureResult, 'filesRemoved' | 'filesFailed'>>(
    data,
    ['learner_id', 'summary', 'storage'],
    'the erasure result',
  );
  let filesRemoved = 0;
  let filesFailed = 0;
  for (const bucket of ['learner-documents', 'assignment-files'] as const) {
    const paths = result.storage[bucket] ?? [];
    if (paths.length === 0) continue;
    const { data: removed, error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error(`Erasure: failed to remove files from ${bucket}`, removeError);
      filesFailed += paths.length;
    } else {
      filesRemoved += removed.length;
      filesFailed += paths.length - removed.length;
    }
  }
  return { ...result, filesRemoved, filesFailed };
}

export async function createDataSubjectRequest(input: {
  schoolId: string;
  subjectLearnerId?: string | null;
  subjectProfileId?: string | null;
  requestType: DsarRequestType;
  reason: string;
}) {
  const { data, error } = await supabase.rpc('create_data_subject_request', {
    p_school_id: input.schoolId,
    p_subject_learner_id: input.subjectLearnerId ?? null,
    p_subject_profile_id: input.subjectProfileId ?? null,
    p_request_type: input.requestType,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Amendments

export async function listAmendments(schoolId: string): Promise<RecordAmendmentRequestRow[]> {
  const { data, error } = await supabase
    .from('record_amendment_requests')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function decideAmendment(
  requestId: string,
  status: 'under_review' | 'approved' | 'denied' | 'closed',
  notes: string | null,
) {
  const { data, error } = await supabase.rpc('decide_record_amendment', {
    p_request_id: requestId,
    p_status: status,
    p_decision_notes: notes,
  });
  if (error) throw error;
  return data;
}

export async function submitAmendment(input: {
  learnerId: string;
  recordArea: AmendmentRecordArea;
  requestedChange: string;
  reason: string;
  currentValue?: string;
}) {
  const { data, error } = await supabase.rpc('submit_record_amendment', {
    p_learner_id: input.learnerId,
    p_record_area: input.recordArea,
    p_requested_change: input.requestedChange,
    p_reason: input.reason,
    p_current_value: input.currentValue || null,
  });
  if (error) throw error;
  return data;
}

export async function respondToDenial(
  requestId: string,
  requestHearing: boolean,
  statement: string,
) {
  const { data, error } = await supabase.rpc('respond_to_amendment_denial', {
    p_request_id: requestId,
    p_request_hearing: requestHearing,
    p_disagreement_statement: statement || null,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Consent

export async function listConsents(schoolId: string): Promise<ParentalConsentRow[]> {
  const { data, error } = await supabase
    .from('parental_consents')
    .select('*')
    .eq('school_id', schoolId)
    .order('decided_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function recordConsent(input: {
  learnerId: string;
  purpose: ConsentPurpose;
  decision: ConsentDecision;
  attestedName: string;
  method?: ConsentMethod;
}): Promise<ParentalConsentRow> {
  const { data, error } = await supabase.rpc('record_parental_consent', {
    p_learner_id: input.learnerId,
    p_purpose: input.purpose,
    p_decision: input.decision,
    p_attested_name: input.attestedName || null,
    p_method: input.method ?? 'in_app_attestation',
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Disclosures

export async function listDisclosures(schoolId: string): Promise<RecordDisclosureRow[]> {
  const { data, error } = await supabase
    .from('record_disclosures')
    .select('*')
    .eq('school_id', schoolId)
    .order('disclosed_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function recordDisclosure(input: {
  learnerId: string;
  disclosedTo: string;
  recipientType: DisclosureRecipientType;
  legalBasis: string;
  dataCategories: string[];
}) {
  const { data, error } = await supabase.rpc('record_disclosure', {
    p_learner_id: input.learnerId,
    p_disclosed_to: input.disclosedTo,
    p_recipient_type: input.recipientType,
    p_legal_basis: input.legalBasis,
    p_data_categories: input.dataCategories,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Audit + access logs

export async function listAuditLog(
  schoolId: string,
  page: number,
  actionFilter: string,
): Promise<Page<AuditLogRow>> {
  let query = supabase.from('audit_log').select('*', { count: 'exact' }).eq('school_id', schoolId);
  if (actionFilter.trim()) query = query.ilike('action', `%${actionFilter.trim()}%`);
  const from = page * PAGE_SIZE;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function listAccessLog(
  schoolId: string,
  page: number,
  learnerId: string | null,
): Promise<Page<StudentRecordAccessLogRow>> {
  let query = supabase
    .from('student_record_access_log')
    .select('*', { count: 'exact' })
    .eq('school_id', schoolId);
  if (learnerId) query = query.eq('learner_id', learnerId);
  const from = page * PAGE_SIZE;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

/** Records that the caller viewed/exported/printed a learner record. Never blocks the page: a failure is logged, not thrown. */
export async function logRecordAccess(
  learnerId: string,
  accessType: 'view' | 'export' | 'print',
  context: string,
): Promise<void> {
  const { error } = await supabase.rpc('log_learner_record_access', {
    p_learner_id: learnerId,
    p_access_type: accessType,
    p_context: context,
  });
  if (error) console.error('Failed to write record-access log', error);
}

// ---------------------------------------------------------------------------
// Content safety

export async function listContentSafetyEvents(
  schoolId: string,
  status: ContentSafetyEventStatus | 'all',
): Promise<ContentSafetyEventRow[]> {
  let query = supabase.from('content_safety_events').select('*').eq('school_id', schoolId);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}

export async function reviewContentSafetyEvent(
  eventId: string,
  status: Exclude<ContentSafetyEventStatus, 'open'>,
  notes: string,
) {
  const { error } = await supabase.rpc('review_content_safety_event', {
    p_event_id: eventId,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) throw error;
}

export async function listContentSafetyRules(): Promise<ContentSafetyRuleRow[]> {
  const { data, error } = await supabase
    .from('content_safety_rules')
    .select('*')
    .order('school_id', { nullsFirst: true })
    .order('category');
  if (error) throw error;
  return data;
}

export async function saveContentSafetyRule(input: {
  schoolId: string;
  ruleId?: string;
  category: ContentSafetyCategory;
  pattern: string;
  action: 'block' | 'flag';
  description: string;
  active: boolean;
}) {
  const { error } = await supabase.rpc('upsert_content_safety_rule', {
    p_school_id: input.schoolId,
    p_category: input.category,
    p_pattern: input.pattern,
    p_action: input.action,
    p_description: input.description || null,
    p_active: input.active,
    p_rule_id: input.ruleId ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Family (guardian / learner) self-service

export async function getMyPrivacyOverview(): Promise<PrivacyOverview> {
  const { data, error } = await supabase.rpc('get_my_privacy_overview');
  if (error) throw error;
  const overview = expectShape<PrivacyOverview>(
    data,
    ['settings', 'children', 'requests', 'amendments'],
    'your privacy information',
  );
  if (!Array.isArray(overview.children))
    throw new Error('Unexpected response while loading your privacy information.');
  return overview;
}

export async function getLearnerRecordPackage(learnerId: string): Promise<LearnerRecordPackage> {
  const { data, error } = await supabase.rpc('get_learner_record_package', {
    p_learner_id: learnerId,
  });
  if (error) throw error;
  return expectShape<LearnerRecordPackage>(
    data,
    ['format', 'learner', 'attendance', 'privacy'],
    'the learner record',
  );
}

export async function getLearnerPrivacyHistory(learnerId: string): Promise<PrivacyHistory> {
  const { data, error } = await supabase.rpc('get_learner_privacy_history', {
    p_learner_id: learnerId,
  });
  if (error) throw error;
  return expectShape<PrivacyHistory>(data, ['access', 'disclosures'], 'the access history');
}
