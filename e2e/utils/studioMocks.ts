import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './mockData';

/** Network mocks for the Content Studio, shared by the workflow and accessibility specs. */

export const VERSION = 'v-a';
export const TOPIC = 't1';
export const LESSON = 'lesson-ai';
export const RESOURCE = 'res-ai';
export const ASSESSMENT = 'asmt-ai';

type FunctionMode = 'created' | 'rejected' | 'failed' | 'not_configured' | 'forbidden';

export interface StudioCalls {
  draft: unknown[];
  validate: unknown[];
  acknowledge: unknown[];
  transitions: unknown[];
  references: unknown[];
  checks: unknown[];
  verifications: unknown[];
  registered: unknown[];
  sourcesVerified: unknown[];
  evidence: unknown[];
}

export interface StudioState {
  status: 'draft' | 'review' | 'approved' | 'published' | 'retired';
  ran: boolean;
  functionMode: FunctionMode;
  transitionError: string | null;
  verification: 'unverified' | 'source_backed' | 'reviewed' | 'verified';
  acknowledged: boolean;
  src: {
    status: 'registered' | 'verified';
    indexed_on: string | null;
    checksum_sha256: string | null;
    retrieved_on: string | null;
    verified_at: string | null;
    content_reviewed_at: string | null;
    content_review_note: string | null;
  };
  references: Array<Record<string, unknown>>;
}

const lessonRow = {
  id: LESSON,
  lineage_id: LESSON,
  version_number: 1,
  curriculum_version_id: VERSION,
  grade_subject_id: 'gs1',
  topic_id: TOPIC,
  title: 'Counting in hundreds',
  description: 'Learners count forward and backward in hundreds.',
  estimated_minutes: 45,
  difficulty: 'standard',
  language: 'en',
  teacher_notes: 'Start with bundles of sticks. Ask learners to explain each jump.',
  learner_instructions: 'Count with your group.',
  sort_order: 1,
  accessibility: {},
  origin: 'ai_draft',
  ai_disclosure:
    'AI-assisted draft (mock-model-1, prompt lesson-pack-v1). It has not been checked against official curriculum documents.',
  created_at: '2026-10-02T08:00:00Z',
  updated_at: '2026-10-02T08:00:00Z',
};

const resourceRow = {
  id: RESOURCE,
  lineage_id: RESOURCE,
  version_number: 1,
  curriculum_version_id: VERSION,
  grade_subject_id: 'gs1',
  topic_id: TOPIC,
  stage: 'explain',
  resource_kind: 'teacher_explanation',
  title: 'Counting in hundreds: explain',
  summary: 'What to say',
  difficulty: 'standard',
  language: 'en',
  estimated_minutes: 10,
  delivery_formats: ['text', 'teacher_led'],
  connectivity: 'none',
  device: 'teacher_device',
  projector_required: false,
  printable: false,
  cacheable: true,
  size_kb: 1,
  media_path: null,
  accessibility: {},
  origin: 'ai_draft',
  ai_disclosure: 'AI-assisted draft.',
  status: 'draft',
  body: { blocks: [{ type: 'paragraph', text: 'Say: we count in hundreds. 100, 200, 300.' }] },
  created_at: '2026-10-02T08:00:00Z',
  updated_at: '2026-10-02T08:00:00Z',
};

const assessmentRow = {
  id: ASSESSMENT,
  curriculum_version_id: VERSION,
  grade_subject_id: 'gs1',
  topic_id: TOPIC,
  lesson_id: LESSON,
  title: 'Counting in hundreds: quick check',
  purpose: 'formative',
  difficulty: 'standard',
  estimated_minutes: 10,
  mastery_percent: 80,
  support_below_percent: 50,
  language: 'en',
  origin: 'ai_draft',
  ai_disclosure: 'AI-assisted draft.',
  status: 'draft',
  created_at: '2026-10-02T08:00:00Z',
  updated_at: '2026-10-02T08:00:00Z',
};

const source = (state: StudioState) => ({
  id: 'src-1',
  title: 'Mathematics policy statement (test)',
  publisher: 'Test publisher',
  doc_type: 'caps_policy',
  url: null,
  edition: '2026',
  licence: 'Used under a test licence',
  excerpts_permitted: false,
  note: null,
  created_at: '2026-10-01T08:00:00Z',
  ...state.src,
});

function findings(state: StudioState) {
  if (!state.ran) return [];
  return [
    {
      id: 'f-error',
      run_id: 'run-1',
      severity: 'error',
      category: 'safety',
      code: 'external_link',
      message: 'Contains a web link. Content must be self-contained; links are not allowed.',
      path: 'lesson text',
      acknowledged_at: null,
      ack_note: null,
    },
    {
      id: 'f-warn',
      run_id: 'run-1',
      severity: 'warning',
      category: 'safety',
      code: 'unsupported_claim',
      message: 'Makes a factual claim without a source. A reviewer must confirm or remove it.',
      path: 'resource text',
      acknowledged_at: state.acknowledged ? '2026-10-02T09:00:00Z' : null,
      ack_note: state.acknowledged ? 'Claim removed in teaching' : null,
    },
    {
      id: 'f-info',
      run_id: 'run-1',
      severity: 'info',
      category: 'structure',
      code: 'toolkit_missing_print',
      message: 'The toolkit has no print resource yet.',
      path: 'resources',
      acknowledged_at: null,
      ack_note: null,
    },
  ];
}

function provenance(state: StudioState) {
  const refs = state.references;
  return {
    entity: 'lessons',
    id: LESSON,
    origin: 'ai_draft',
    status: state.status,
    ai_disclosure: lessonRow.ai_disclosure,
    created_by: { id: 'admin-1', name: 'Platform Admin' },
    created_at: '2026-10-02T08:00:00Z',
    reviewed_by: null,
    approved_by:
      state.status === 'approved' || state.status === 'published' ? 'Second Admin' : null,
    approved_at:
      state.status === 'approved' || state.status === 'published' ? '2026-10-03T08:00:00Z' : null,
    published_at: null,
    generation: {
      request_id: 'req-1',
      requested_by: 'Platform Admin',
      requested_at: '2026-10-02T08:00:00Z',
      provider: 'mock',
      model: 'mock-model-1',
      prompt_version: 'lesson-pack-v1',
      schema_version: '1',
      curriculum_version_id: VERSION,
      topic_id: TOPIC,
      instruction: null,
      output_hash: 'abc',
      objectives: [{ code: 'AI.O1', description: 'Count forward in hundreds.' }],
    },
    sources: refs.map((r) => ({
      reference_id: r.id,
      locator: r.locator,
      supports: r.supports,
      check_result: r.check_result,
      checked_at: null,
      source: {
        id: 'src-1',
        title: 'Mathematics policy statement (test)',
        publisher: 'Test publisher',
        doc_type: 'caps_policy',
        licence: 'x',
        status: state.src.status,
      },
    })),
    verification: {
      status: state.verification,
      recorded_status: state.verification,
      stale: false,
      set_at: null,
      note: null,
    },
    validation: state.ran
      ? {
          run_id: 'run-1',
          run_at: '2026-10-02T09:00:00Z',
          passed: false,
          stale: false,
          errors: 1,
          warnings: 1,
          info: 1,
          unacknowledged_warnings: state.acknowledged ? 0 : 1,
        }
      : null,
    review_events:
      state.status === 'draft'
        ? []
        : [
            {
              from: 'draft',
              to: 'review',
              at: '2026-10-03T07:00:00Z',
              note: null,
              by: 'Second Admin',
            },
          ],
  };
}

/** Respond like PostgREST: an object for `.single()` requests (id=eq.X), an array otherwise. */
function pick(route: Route, rows: Array<Record<string, unknown>>) {
  const id = new URL(route.request().url()).searchParams.get('id');
  const wantsObject = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
  if (wantsObject) return rows.find((r) => `eq.${r.id}` === id) ?? rows[0] ?? null;
  return rows;
}

export async function mockStudio(page: Page, options: { role?: string } = {}) {
  const role = options.role ?? 'platform_administrator';
  const calls: StudioCalls = {
    draft: [],
    validate: [],
    acknowledge: [],
    transitions: [],
    references: [],
    checks: [],
    verifications: [],
    registered: [],
    sourcesVerified: [],
    evidence: [],
  };
  const state: StudioState = {
    status: 'draft',
    ran: false,
    functionMode: 'created',
    transitionError: null,
    verification: 'unverified',
    acknowledged: false,
    src: {
      status: 'registered',
      indexed_on: null,
      checksum_sha256: null,
      retrieved_on: null,
      verified_at: null,
      content_reviewed_at: null,
      content_review_note: null,
    },
    references: [],
  };

  await seedAuthenticatedSession(page, { role: role as 'teacher' });
  const platform = role === 'platform_administrator';
  await installDataMocks(page, {
    profile: buildMockProfileRow({
      role: role as 'teacher',
      ...(platform ? { tenantId: null } : {}),
    }),
    ...(platform ? {} : { school: buildMockSchoolRow() }),
  });
  await page.route('**/rest/v1/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (/\/(profiles|schools|academic_years)$/.test(pathname)) return route.fallback();
    return fulfillJson(route, []);
  });
  const get = (table: string, rows: (route: Route) => unknown) =>
    page.route(`**/rest/v1/${table}*`, async (route) =>
      route.request().method() === 'GET' ? fulfillJson(route, rows(route)) : route.fallback(),
    );

  await get('curriculum_versions', () => [
    { id: VERSION, code: 'ZA-AI-TEST-A', name: 'AI test curriculum', status: 'published' },
  ]);
  await get('curriculum_topics', () => [
    { id: TOPIC, term_id: 'term-1', title: 'Counting in hundreds', sort_order: 1 },
  ]);
  await get('curriculum_terms', () => [{ id: 'term-1', grade_subject_id: 'gs1', term_number: 1 }]);
  await get('curriculum_grade_subjects', () => [{ id: 'gs1', grade_id: 'g4', subject_id: 'math' }]);
  await get('curriculum_grades', () => [{ id: 'g4', name: 'Grade 4', grade_number: 4 }]);
  await get('curriculum_subjects', () => [{ id: 'math', name: 'Mathematics' }]);
  await get('curriculum_objectives', () => [
    {
      id: 'o1',
      version_id: VERSION,
      topic_id: TOPIC,
      subtopic_id: null,
      code: 'AI.O1',
      description: 'Count forward in hundreds.',
      language: 'en',
      source_reference: null,
      status: 'published',
      sort_order: 1,
      version: 1,
    },
    {
      id: 'o2',
      version_id: VERSION,
      topic_id: TOPIC,
      subtopic_id: null,
      code: 'AI.O2',
      description: 'An objective that is still a draft.',
      language: 'en',
      source_reference: null,
      status: 'draft',
      sort_order: 2,
    },
  ]);
  await get('lessons', (r) => pick(r, [{ ...lessonRow, status: state.status }]));
  await get('teaching_resources', (r) => {
    const id = new URL(r.request().url()).searchParams.get('id') ?? '';
    if (id.startsWith('in.'))
      return [{ id: RESOURCE, title: resourceRow.title, stage: 'explain', status: 'draft' }];
    return pick(r, [resourceRow]);
  });
  await get('learning_assessments', (r) => pick(r, [assessmentRow]));
  await get('lesson_objectives', () => [{ objective_id: 'o1' }]);
  await get('lesson_resources', () => [{ resource_id: RESOURCE, sort_order: 1 }]);
  await get('learning_activities', () => [
    {
      id: 'act-1',
      lesson_id: LESSON,
      curriculum_version_id: VERSION,
      title: 'Count the bundles',
      instructions: 'In pairs, count the bundles aloud.',
      activity_type: 'pair_work',
      grouping: 'pair',
      difficulty: 'standard',
      estimated_minutes: 10,
      resource_id: null,
      sort_order: 1,
    },
  ]);
  await get('assessment_questions', () => [
    {
      id: 'q1',
      assessment_id: ASSESSMENT,
      curriculum_version_id: VERSION,
      position: 1,
      question_type: 'multiple_choice',
      prompt: 'What comes after 100?',
      options: ['150', '200', '300'],
      marks: 1,
      objective_id: 'o1',
    },
  ]);
  await get('assessment_question_keys', () => [
    { question_id: 'q1', answer: '200', feedback: 'Add one hundred.' },
  ]);
  await get('content_validation_runs', () => (state.ran ? [{ id: 'run-1' }] : []));
  await get('content_validation_findings', () => findings(state));
  await get('curriculum_sources', () => [source(state)]);
  await get('content_source_references', () => state.references);

  const rpc = (
    name: string,
    handler: (payload: Record<string, unknown>, route: Route) => unknown,
  ) =>
    page.route(`**/rest/v1/rpc/${name}`, async (route) =>
      handler(route.request().postDataJSON() as Record<string, unknown>, route),
    );
  const ok = (route: Route, body: unknown) => fulfillJson(route, body);
  const rejected = (route: Route, message: string) =>
    fulfillJson(route, { code: 'P0001', message, details: null, hint: null }, 400);

  await rpc('content_provenance', (_p, route) => ok(route, provenance(state)));
  await rpc('validate_content', (p, route) => {
    calls.validate.push(p);
    state.ran = true;
    state.acknowledged = false;
    return ok(route, 'run-1');
  });
  await rpc('acknowledge_validation_finding', (p, route) => {
    calls.acknowledge.push(p);
    state.acknowledged = true;
    return ok(route, null);
  });
  await rpc('content_transition', (p, route) => {
    calls.transitions.push(p);
    if (state.transitionError) return rejected(route, state.transitionError);
    state.status = p.p_to as StudioState['status'];
    return ok(route, null);
  });
  await rpc('add_content_source_reference', (p, route) => {
    calls.references.push(p);
    state.references.push({
      id: 'ref-1',
      entity_table: 'lessons',
      entity_id: LESSON,
      source_id: 'src-1',
      locator: p.p_locator,
      supports: p.p_supports ?? null,
      check_result: null,
      check_note: null,
      checked_at: null,
      created_at: '2026-10-02T09:00:00Z',
    });
    return ok(route, 'ref-1');
  });
  await rpc('check_content_source_reference', (p, route) => {
    calls.checks.push(p);
    state.references = state.references.map((r) => ({ ...r, check_result: p.p_result }));
    return ok(route, null);
  });
  await rpc('set_content_verification', (p, route) => {
    calls.verifications.push(p);
    state.verification = p.p_status as StudioState['verification'];
    return ok(route, null);
  });
  await rpc('register_curriculum_source', (p, route) => {
    calls.registered.push(p);
    return ok(route, 'src-2');
  });
  await rpc('verify_curriculum_source', (p, route) => {
    calls.sourcesVerified.push(p);
    if (!state.src.checksum_sha256) {
      return rejected(
        route,
        "invalid_state: record the downloaded file's SHA-256 and date first; identity cannot be verified without the actual bytes",
      );
    }
    state.src.status = 'verified';
    state.src.verified_at = '2026-10-03T08:00:00Z';
    return ok(route, null);
  });
  await rpc('record_source_evidence', (p, route) => {
    calls.evidence.push(p);
    if (p.p_level === 'indexed') state.src.indexed_on = (p.p_on as string) || '2026-10-03';
    if (p.p_level === 'retrieved') {
      state.src.checksum_sha256 = p.p_sha256 as string;
      state.src.retrieved_on = p.p_on as string;
    }
    if (p.p_level === 'content_reviewed') {
      state.src.content_reviewed_at = '2026-10-03T09:00:00Z';
      state.src.content_review_note = p.p_note as string;
    }
    return ok(route, null);
  });

  await page.route('**/functions/v1/curriculum-ai-draft', async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
        },
      });
    calls.draft.push(route.request().postDataJSON());
    const cors = { 'access-control-allow-origin': '*' };
    const send = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify(body),
      });
    switch (state.functionMode) {
      case 'created':
        return send(200, {
          status: 'draft_created',
          requestId: 'req-1',
          lessonId: LESSON,
          resourceIds: [RESOURCE, 'res-2'],
          assessmentId: ASSESSMENT,
        });
      case 'rejected':
        return send(200, {
          status: 'rejected_output',
          requestId: 'req-1',
          reasons: [
            'question 1 must map to one of the requested objectives',
            'resource 2 has an unknown stage',
          ],
        });
      case 'failed':
        return send(200, { status: 'failed', requestId: 'req-1', reason: 'provider_timeout' });
      case 'not_configured':
        return send(503, { error: 'not_configured' });
      case 'forbidden':
        return send(403, { error: 'forbidden' });
    }
  });
  return { calls, state };
}
