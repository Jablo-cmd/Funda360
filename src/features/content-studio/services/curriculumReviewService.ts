import { supabase } from '@/lib/supabase';
import type {
  CurriculumFormalAssessmentDetailsRow,
  CurriculumOpenQuestionRow,
  CurriculumReviewFindingRow,
  CurriculumSourceRow,
  FindingCategory,
  ReviewDecisionValue,
  ReviewEntityType,
} from '@/lib/database.types';
import type { ReviewSummary } from '@/features/content-studio/utils/review';

/** Network calls for the curriculum review. Every write is an RPC that re-checks the caller in the database. */

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw error;
}

async function rpc<T>(
  call: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
): Promise<T | null> {
  const { data, error } = await call;
  fail(error);
  return data;
}

export interface ReviewVersion {
  id: string;
  code: string;
  name: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'retired';
  review_workflow: boolean;
}

async function listReviewVersions(): Promise<ReviewVersion[]> {
  const { data, error } = await supabase
    .from('curriculum_versions')
    .select('id, code, name, status, review_workflow')
    .eq('review_workflow', true)
    .order('code');
  fail(error);
  return (data ?? []) as ReviewVersion[];
}

async function versionByCode(code: string): Promise<ReviewVersion | null> {
  const { data, error } = await supabase
    .from('curriculum_versions')
    .select('id, code, name, status, review_workflow')
    .eq('code', code)
    .maybeSingle();
  fail(error);
  return (data as ReviewVersion | null) ?? null;
}

async function summary(versionId: string): Promise<ReviewSummary> {
  const data = await rpc(supabase.rpc('curriculum_review_summary', { p_version_id: versionId }));
  return data as unknown as ReviewSummary;
}

async function items<T>(versionId: string, type: ReviewEntityType): Promise<T[]> {
  const data = await rpc(supabase.rpc('curriculum_review_items', { p_version_id: versionId, p_type: type }));
  return (data ?? []) as unknown as T[];
}

async function recordDecision(input: {
  versionId: string;
  entity: ReviewEntityType;
  entityId: string;
  decision: ReviewDecisionValue;
  notes: string;
  sourceId?: string;
  section?: string;
  page?: string;
  category?: FindingCategory;
}): Promise<void> {
  await rpc(
    supabase.rpc('record_curriculum_review', {
      p_version_id: input.versionId,
      p_entity_type: input.entity,
      p_entity_id: input.entityId,
      p_decision: input.decision,
      p_notes: input.notes,
      p_source_id: input.sourceId || null,
      p_source_section: input.section || null,
      p_source_page: input.page || null,
      p_finding_category: input.category ?? null,
    }),
  );
}

async function raiseFinding(input: {
  versionId: string;
  entity: ReviewEntityType;
  entityId: string;
  category: FindingCategory;
  description: string;
}): Promise<void> {
  await rpc(
    supabase.rpc('raise_review_finding', {
      p_version_id: input.versionId,
      p_entity_type: input.entity,
      p_entity_id: input.entityId,
      p_category: input.category,
      p_description: input.description,
    }),
  );
}

async function resolveFinding(id: string, status: 'resolved' | 'dismissed', note: string): Promise<void> {
  await rpc(supabase.rpc('resolve_review_finding', { p_finding_id: id, p_status: status, p_note: note }));
}

async function listFindings(versionId: string): Promise<CurriculumReviewFindingRow[]> {
  const { data, error } = await supabase
    .from('curriculum_review_findings')
    .select('*')
    .eq('version_id', versionId)
    .order('raised_at', { ascending: false });
  fail(error);
  return (data ?? []) as CurriculumReviewFindingRow[];
}

async function listOpenQuestions(versionId: string): Promise<CurriculumOpenQuestionRow[]> {
  const { data, error } = await supabase
    .from('curriculum_open_questions')
    .select('*')
    .eq('version_id', versionId)
    .order('code');
  fail(error);
  const rows = (data ?? []) as CurriculumOpenQuestionRow[];
  return rows.sort((a, b) => Number(a.code.slice(1)) - Number(b.code.slice(1)));
}

async function resolveQuestion(input: {
  id: string;
  status: 'open' | 'resolved' | 'deferred';
  answer: string;
  sourceId: string;
  section: string;
  page: string;
  notes: string;
}): Promise<void> {
  await rpc(
    supabase.rpc('resolve_open_question', {
      p_question_id: input.id,
      p_status: input.status,
      p_answer: input.answer || null,
      p_source_id: input.sourceId || null,
      p_source_section: input.section || null,
      p_source_page: input.page || null,
      p_notes: input.notes,
    }),
  );
}

async function listFormalAssessments(versionId: string): Promise<
  Array<CurriculumFormalAssessmentDetailsRow & { objective_code: string; objective_description: string }>
> {
  const [details, objectives] = await Promise.all([
    supabase.from('curriculum_formal_assessment_details').select('*').eq('version_id', versionId),
    supabase.from('curriculum_objectives').select('id, code, description').eq('version_id', versionId),
  ]);
  fail(details.error);
  fail(objectives.error);
  const byId = new Map((objectives.data ?? []).map((o) => [o.id, o]));
  return ((details.data ?? []) as CurriculumFormalAssessmentDetailsRow[]).map((d) => ({
    ...d,
    objective_code: byId.get(d.objective_id)?.code ?? '',
    objective_description: byId.get(d.objective_id)?.description ?? '',
  }));
}

async function recordFormalDetails(input: {
  versionId: string;
  objectiveId: string;
  name: string;
  type: string;
  scope: string;
  durationMinutes: number | null;
  timing: string;
  marks: number | null;
  weighting: string;
  instructions: string;
  sourceId: string;
  section: string;
  page: string;
  notes: string;
}): Promise<void> {
  await rpc(
    supabase.rpc('record_formal_assessment_details', {
      p_version_id: input.versionId,
      p_objective_id: input.objectiveId,
      p_name: input.name,
      p_type: input.type,
      p_scope: input.scope,
      p_duration_minutes: input.durationMinutes,
      p_timing: input.timing || null,
      p_marks: input.marks,
      p_weighting: input.weighting || null,
      p_instructions: input.instructions || null,
      p_source_id: input.sourceId,
      p_source_section: input.section,
      p_source_page: input.page,
      p_notes: input.notes,
    }),
  );
}

async function listSources(): Promise<CurriculumSourceRow[]> {
  const { data, error } = await supabase.from('curriculum_sources').select('*').order('title');
  fail(error);
  return (data ?? []) as CurriculumSourceRow[];
}

async function recordRetrieval(sourceId: string, record: string): Promise<void> {
  await rpc(supabase.rpc('record_source_retrieval', { p_source_id: sourceId, p_record: record }));
}

async function recordSourceReview(input: {
  sourceId: string;
  kind: 'identity' | 'document' | 'licence';
  decision: string;
  notes: string;
  findings?: string;
}): Promise<void> {
  await rpc(
    supabase.rpc('record_source_review', {
      p_source_id: input.sourceId,
      p_kind: input.kind,
      p_decision: input.decision,
      p_notes: input.notes,
      p_findings: input.findings || null,
    }),
  );
}

async function correctEvidence(sourceId: string, reason: string): Promise<void> {
  await rpc(supabase.rpc('correct_source_evidence', { p_source_id: sourceId, p_reason: reason }));
}

export const curriculumReviewService = {
  listReviewVersions,
  versionByCode,
  summary,
  items,
  recordDecision,
  raiseFinding,
  resolveFinding,
  listFindings,
  listOpenQuestions,
  resolveQuestion,
  listFormalAssessments,
  recordFormalDetails,
  listSources,
  recordRetrieval,
  recordSourceReview,
  correctEvidence,
};
