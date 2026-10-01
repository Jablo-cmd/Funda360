import { supabase } from '@/lib/supabase';
import type {
  ContentEntityTable,
  ContentStatus,
  ContentVerificationStatus,
  CurriculumSourceRow,
} from '@/lib/database.types';
import { DRAFT_ERRORS, TRANSITION_ENTITY } from '@/features/content-studio/utils/studio';
import type {
  DraftResponse,
  ReviewData,
  TopicChoice,
  UnitContent,
  UnitSummary,
  VersionOption,
} from '@/features/content-studio/types';

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw error;
}

async function listVersions(): Promise<VersionOption[]> {
  const { data, error } = await supabase
    .from('curriculum_versions')
    .select('id, code, name, status')
    .order('code');
  fail(error);
  return (data ?? []) as VersionOption[];
}

/** Every topic of a version with its place in the hierarchy and its objectives, for choosing what to draft. */
async function listTopicChoices(versionId: string): Promise<TopicChoice[]> {
  const [topics, terms, gradeSubjects, grades, subjects, objectives] = await Promise.all([
    supabase
      .from('curriculum_topics')
      .select('id, term_id, title, sort_order')
      .eq('version_id', versionId),
    supabase
      .from('curriculum_terms')
      .select('id, grade_subject_id, term_number')
      .eq('version_id', versionId),
    supabase
      .from('curriculum_grade_subjects')
      .select('id, grade_id, subject_id')
      .eq('version_id', versionId),
    supabase.from('curriculum_grades').select('id, name, grade_number').eq('version_id', versionId),
    supabase.from('curriculum_subjects').select('id, name').eq('version_id', versionId),
    supabase
      .from('curriculum_objectives')
      .select(
        'id, version_id, topic_id, subtopic_id, code, description, language, source_reference, status, sort_order',
      )
      .eq('version_id', versionId)
      .order('sort_order'),
  ]);
  for (const r of [topics, terms, gradeSubjects, grades, subjects, objectives]) fail(r.error);
  const termById = new Map((terms.data ?? []).map((t) => [t.id, t]));
  const gsById = new Map((gradeSubjects.data ?? []).map((g) => [g.id, g]));
  const gradeById = new Map((grades.data ?? []).map((g) => [g.id, g]));
  const subjectById = new Map((subjects.data ?? []).map((s) => [s.id, s]));
  return (topics.data ?? [])
    .map((topic) => {
      const term = termById.get(topic.term_id);
      const gs = term ? gsById.get(term.grade_subject_id) : undefined;
      const grade = gs ? gradeById.get(gs.grade_id) : undefined;
      const subject = gs ? subjectById.get(gs.subject_id) : undefined;
      return {
        id: topic.id,
        sort: [
          grade?.grade_number ?? 0,
          subject?.name ?? '',
          term?.term_number ?? 0,
          topic.sort_order,
        ] as const,
        label: `${grade?.name ?? 'Grade'} · ${subject?.name ?? 'Subject'} · Term ${term?.term_number ?? '?'} · ${topic.title}`,
        objectives: (objectives.data ?? []).filter((o) => o.topic_id === topic.id),
      };
    })
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
    .map(({ id, label, objectives: objs }) => ({ id, label, objectives: objs }));
}

async function listUnits(table: ContentEntityTable): Promise<UnitSummary[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, title, status, origin, topic_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  fail(error);
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    status: ContentStatus;
    origin: 'authored' | 'ai_draft';
    topic_id: string;
    updated_at: string;
  }>;
  const topicIds = [...new Set(rows.map((r) => r.topic_id))];
  const topics = topicIds.length
    ? await supabase.from('curriculum_topics').select('id, title').in('id', topicIds)
    : { data: [], error: null };
  fail(topics.error);
  const topicTitle = new Map((topics.data ?? []).map((t) => [t.id, t.title]));
  return rows.map((r) => ({
    table,
    id: r.id,
    title: r.title,
    status: r.status,
    origin: r.origin,
    topicLabel: topicTitle.get(r.topic_id) ?? '',
    updatedAt: r.updated_at,
  }));
}

async function loadContent(table: ContentEntityTable, id: string): Promise<UnitContent> {
  if (table === 'teaching_resources') {
    const { data, error } = await supabase
      .from('teaching_resources')
      .select('*')
      .eq('id', id)
      .single();
    fail(error);
    return { kind: 'teaching_resources', resource: data as never };
  }
  if (table === 'learning_assessments') {
    const [a, q, k] = await Promise.all([
      supabase.from('learning_assessments').select('*').eq('id', id).single(),
      supabase.from('assessment_questions').select('*').eq('assessment_id', id).order('position'),
      supabase
        .from('assessment_question_keys')
        .select('question_id, answer, feedback')
        .eq('assessment_id', id),
    ]);
    fail(a.error);
    fail(q.error);
    fail(k.error);
    const keys = new Map((k.data ?? []).map((x) => [x.question_id, x]));
    return {
      kind: 'learning_assessments',
      assessment: a.data as never,
      questions: (q.data ?? []).map((row) => {
        const key = keys.get(row.id);
        return {
          ...row,
          answer: key ? JSON.stringify(key.answer) : null,
          feedback: key?.feedback ?? null,
        };
      }),
    };
  }
  const [lesson, lo, acts, lr] = await Promise.all([
    supabase.from('lessons').select('*').eq('id', id).single(),
    supabase.from('lesson_objectives').select('objective_id').eq('lesson_id', id),
    supabase.from('learning_activities').select('*').eq('lesson_id', id).order('sort_order'),
    supabase
      .from('lesson_resources')
      .select('resource_id, sort_order')
      .eq('lesson_id', id)
      .order('sort_order'),
  ]);
  fail(lesson.error);
  fail(lo.error);
  fail(acts.error);
  fail(lr.error);
  const objectiveIds = (lo.data ?? []).map((x) => x.objective_id);
  const resourceIds = (lr.data ?? []).map((x) => x.resource_id);
  const [objs, res] = await Promise.all([
    objectiveIds.length
      ? supabase.from('curriculum_objectives').select('code, description').in('id', objectiveIds)
      : Promise.resolve({ data: [], error: null }),
    resourceIds.length
      ? supabase.from('teaching_resources').select('id, title, stage, status').in('id', resourceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  fail(objs.error);
  fail(res.error);
  const order = new Map(resourceIds.map((rid, i) => [rid, i]));
  return {
    kind: 'lessons',
    lesson: lesson.data as never,
    objectives: (objs.data ?? []) as Array<{ code: string; description: string }>,
    activities: (acts.data ?? []) as never,
    resources: (
      (res.data ?? []) as Array<{ id: string; title: string; stage: string; status: ContentStatus }>
    ).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
  };
}

async function loadReview(table: ContentEntityTable, id: string): Promise<ReviewData> {
  const [content, provenance, run, sources, references] = await Promise.all([
    loadContent(table, id),
    supabase.rpc('content_provenance', { p_entity: table, p_id: id }),
    supabase
      .from('content_validation_runs')
      .select('id')
      .eq('entity_table', table)
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('curriculum_sources').select('*').neq('status', 'retired').order('title'),
    supabase
      .from('content_source_references')
      .select('*')
      .eq('entity_table', table)
      .eq('entity_id', id)
      .order('created_at'),
  ]);
  fail(provenance.error);
  fail(run.error);
  fail(sources.error);
  fail(references.error);
  const runId = run.data?.[0]?.id;
  const findings = runId
    ? await supabase
        .from('content_validation_findings')
        .select('*')
        .eq('run_id', runId)
        .order('severity')
    : { data: [], error: null };
  fail(findings.error);
  return {
    content,
    provenance: provenance.data as never,
    findings: (findings.data ?? []) as never,
    sources: (sources.data ?? []) as CurriculumSourceRow[],
    references: (references.data ?? []) as never,
  };
}

async function rpc<T>(
  call: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
): Promise<T | null> {
  const { data, error } = await call;
  fail(error);
  return data;
}

async function validate(table: ContentEntityTable, id: string): Promise<void> {
  await rpc(supabase.rpc('validate_content', { p_entity: table, p_id: id }));
}

async function acknowledge(findingId: string, note: string): Promise<void> {
  await rpc(
    supabase.rpc('acknowledge_validation_finding', { p_finding_id: findingId, p_note: note }),
  );
}

async function transition(
  table: ContentEntityTable,
  id: string,
  to: ContentStatus,
  note: string,
): Promise<void> {
  await rpc(
    supabase.rpc('content_transition', {
      p_entity: TRANSITION_ENTITY[table],
      p_id: id,
      p_to: to,
      p_note: note || null,
    }),
  );
}

async function setVerification(
  table: ContentEntityTable,
  id: string,
  status: ContentVerificationStatus,
  note: string,
): Promise<void> {
  await rpc(
    supabase.rpc('set_content_verification', {
      p_entity: table,
      p_id: id,
      p_status: status,
      p_note: note || null,
    }),
  );
}

async function addReference(
  table: ContentEntityTable,
  id: string,
  sourceId: string,
  locator: string,
  supports: string,
): Promise<void> {
  await rpc(
    supabase.rpc('add_content_source_reference', {
      p_entity: table,
      p_id: id,
      p_source_id: sourceId,
      p_locator: locator,
      p_supports: supports || null,
    }),
  );
}

async function checkReference(
  referenceId: string,
  result: 'matches' | 'partial' | 'does_not_match',
  note: string,
): Promise<void> {
  await rpc(
    supabase.rpc('check_content_source_reference', {
      p_reference_id: referenceId,
      p_result: result,
      p_note: note || null,
    }),
  );
}

async function listSources(): Promise<CurriculumSourceRow[]> {
  const { data, error } = await supabase
    .from('curriculum_sources')
    .select('*')
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as CurriculumSourceRow[];
}

async function registerSource(input: {
  title: string;
  publisher: string;
  docType: CurriculumSourceRow['doc_type'];
  licence: string;
  url: string;
  edition: string;
  jurisdiction?: string;
  subject?: string;
  gradePhase?: string;
  alternateUrls?: string[];
  isbn?: string;
  note?: string;
}): Promise<void> {
  await rpc(
    supabase.rpc('register_curriculum_source', {
      p_title: input.title,
      p_publisher: input.publisher,
      p_doc_type: input.docType,
      p_licence: input.licence,
      p_url: input.url || null,
      p_edition: input.edition || null,
      p_note: input.note || null,
      p_jurisdiction: input.jurisdiction || null,
      p_subject: input.subject || null,
      p_grade_phase: input.gradePhase || null,
      p_alternate_urls: input.alternateUrls?.length ? input.alternateUrls : null,
      p_isbn: input.isbn || null,
    }),
  );
}

async function recordSourceEvidence(input: { sourceId: string; on?: string; note?: string }): Promise<void> {
  await rpc(
    supabase.rpc('record_source_evidence', {
      p_source_id: input.sourceId,
      p_level: 'indexed',
      p_on: input.on || null,
      p_note: input.note || null,
    }),
  );
}

async function verifySource(sourceId: string, note: string): Promise<void> {
  await rpc(
    supabase.rpc('verify_curriculum_source', { p_source_id: sourceId, p_note: note || null }),
  );
}

/** Asks the curriculum-ai-draft Edge Function for a draft. The reply only ever describes a draft; it cannot approve anything. */
async function requestAiDraft(input: {
  versionId: string;
  topicId: string;
  objectiveIds: string[];
  instruction: string;
}): Promise<DraftResponse> {
  const { data, error } = await supabase.functions.invoke<DraftResponse>('curriculum-ai-draft', {
    body: {
      versionId: input.versionId,
      topicId: input.topicId,
      objectiveIds: input.objectiveIds,
      instruction: input.instruction.trim() || undefined,
    },
  });
  if (error) {
    let code = 'request_failed';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.json()) as { error?: unknown };
        if (typeof body.error === 'string') code = body.error;
      } catch {
        // keep the generic code
      }
    }
    throw new Error(DRAFT_ERRORS[code] ?? DRAFT_ERRORS.request_failed);
  }
  if (!data) throw new Error(DRAFT_ERRORS.request_failed);
  return data;
}

export const contentStudioService = {
  listVersions,
  listTopicChoices,
  listUnits,
  loadReview,
  validate,
  acknowledge,
  transition,
  setVerification,
  addReference,
  checkReference,
  listSources,
  registerSource,
  verifySource,
  recordSourceEvidence,
  requestAiDraft,
};
