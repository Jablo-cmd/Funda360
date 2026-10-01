import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './mockData';

/** Network mocks for the curriculum specialist review screen. The mock database applies the same refusals the real one does. */

export const VERSION_CODE = 'ZA-G4-MATH-2026-T1';
export const VERSION_ID = 'v-g4';

export interface ReviewCalls {
  decisions: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  resolvedFindings: Array<Record<string, unknown>>;
  formal: Array<Record<string, unknown>>;
}

interface Decision {
  entity: string;
  id: string;
  decision: string;
  notes: string;
  source_id: string | null;
  source_section: string | null;
  source_page: string | null;
}

const TOTALS = { objective: 27, lesson: 17, resource: 112, assessment: 6, question: 60 } as const;

const objectives = [
  { id: 'o-wn01', code: 'G4.MATH.2026.T1.WN.01', description: 'Count forwards and backwards in 2s, 3s, 5s, 10s, 25s, 50s and 100s with whole numbers between 0 and at least 10 000.', topic: 'Whole numbers: counting, ordering, representing, place value and rounding', subtopic: 'Counting in steps', source_reference: '2026 Grade 4 Mathematics ATP, Term 1 (item-level page and week NOT verified)', lessons: 1, resources: 7, assessments: 2, questions: 4 },
  { id: 'o-ns03', code: 'G4.MATH.2026.T1.NS.03', description: 'Solve number sentences by trial and improvement.', topic: 'Number sentences and the properties of operations', subtopic: 'Writing, solving and checking number sentences', source_reference: null, lessons: 1, resources: 6, assessments: 2, questions: 2 },
  { id: 'o-fa01', code: 'G4.MATH.2026.T1.FA.01', description: 'Complete the Term 1 assignment, which covers whole numbers, number sentences, and whole-number addition and subtraction. It is completed in class within three hours.', topic: 'Formal assessment: the Term 1 assignment', subtopic: null, source_reference: null, lessons: 1, resources: 4, assessments: 1, questions: 3 },
];
const lessons = [
  { id: 'l-01', title: 'Counting in steps up to 10 000', description: 'Learners count in steps.', teacher_notes: 'Use bottle tops.', learner_instructions: 'Count with your group.', origin: 'authored', status: 'draft', minutes: 40, objectives: ['G4.MATH.2026.T1.WN.01'],
    activities: [{ title: 'Skip counting circle', type: 'group_work', instructions: 'Count around the circle in 50s.', minutes: 10 }],
    resources: [{ title: 'Explain: counting in steps', stage: 'explain', kind: 'teacher_explanation' }, { title: 'Practice: counting', stage: 'practise', kind: 'exercise' }],
    sources: [{ title: 'CAPS Mathematics Grades 4-6', locator: 'Grade 4 Term 1', status: 'registered', check_result: null }] },
  { id: 'l-02', title: 'Place value and representing four-digit numbers', description: 'Learners represent numbers.', teacher_notes: null, learner_instructions: null, origin: 'authored', status: 'draft', minutes: 45, objectives: ['G4.MATH.2026.T1.WN.03'], activities: [], resources: [], sources: [] },
];
const resources = [
  { id: 'r-01', title: 'Teacher explanation: counting in 50s', summary: 'How to count in 50s.', kind: 'teacher_explanation', stage: 'explain', difficulty: 'standard', formats: ['text', 'teacher_led'], printable: false, cacheable: true, projector_required: false, device: 'none', connectivity: 'none', body: { blocks: [{ type: 'paragraph', text: 'Say: we count in fifties.' }, { type: 'tip', text: 'Answers for the teacher: 1) 150' }] }, lessons: ['Counting in steps up to 10 000'], objectives: ['G4.MATH.2026.T1.WN.01'] },
  { id: 'r-02', title: 'Learner worksheet: counting', summary: 'A printable worksheet.', kind: 'worksheet', stage: 'print', difficulty: 'standard', formats: ['printable', 'text'], printable: true, cacheable: true, projector_required: false, device: 'none', connectivity: 'none', body: { blocks: [{ type: 'paragraph', text: 'Count in 100s.' }] }, lessons: ['Counting in steps up to 10 000'], objectives: ['G4.MATH.2026.T1.WN.01'] },
];
const assessments = [{ id: 'a-01', title: 'Practice check: whole numbers', summary: 'formative', minutes: 20, questions: 11 }];
const questions = [
  { id: 'q-01', assessment: 'Practice check: whole numbers', position: 1, type: 'numeric', prompt: 'Count in 5s: 35, 40, 45, __. What is the next number?', options: [], marks: 1, difficulty: 'foundational', objective: 'G4.MATH.2026.T1.WN.01', answer: 50, feedback: 'Add 5 each time.', marking_notes: null },
  { id: 'q-02', assessment: 'Practice check: whole numbers', position: 2, type: 'short_answer', prompt: 'Thandi counts in 50s from 0. Will she say 1 025? Explain how you know.', options: [], marks: 2, difficulty: 'advanced', objective: 'G4.MATH.2026.T1.WN.01', answer: 'No. Counting in 50s the numbers end in 00 or 50.', feedback: null, marking_notes: 'Accept any correct explanation.' },
];

const questionRows = [
  ['Q1', 'Division / inverse operations', true],
  ['Q2', 'Number range', true],
  ['Q3', 'Operations covered by properties', true],
  ['Q4', 'Weeks and hours', false],
  ['Q5', 'Cents / decimals', true],
  ['Q6', 'Formal assignment details', true],
  ['Q7', 'Measurement units', true],
  ['Q8', 'CAPS URL identity and current edition', true],
  ['Q9', 'ATP record completeness', true],
] as const;

export async function mockReview(page: Page, options: { role?: string; sourcesVerified?: boolean } = {}) {
  const role = options.role ?? 'platform_administrator';
  const calls: ReviewCalls = { decisions: [], questions: [], findings: [], resolvedFindings: [], formal: [] };
  const decisions = new Map<string, Decision>();
  const findings: Array<Record<string, unknown>> = [];
  const qState = questionRows.map(([code, title, material], i) => ({
    id: `oq-${i + 1}`, version_id: VERSION_ID, code, title, description: `${title}: the question as documented.`, materially_affects_scope: material,
    status: 'open', answer: null as string | null, source_id: null as string | null, source_section: null as string | null, source_page: null as string | null,
    notes: null as string | null, resolved_by: null as string | null, resolved_at: null as string | null,
  }));
  const formal = {
    id: 'fa-1', version_id: VERSION_ID, objective_id: 'o-fa01', status: 'pending', assessment_name: null as string | null, assessment_type: null as string | null,
    scope: null as string | null, duration_minutes: null as number | null, timing: null as string | null, marks: null as number | null, weighting: null as string | null,
    instructions: null as string | null, source_id: null as string | null, source_section: null as string | null, source_page: null as string | null, notes: null as string | null,
    recorded_by: null as string | null, recorded_at: null as string | null,
  };
  const verified = Boolean(options.sourcesVerified);
  const source = (id: string, title: string, type: string) => ({
    id, title, publisher: 'Department of Basic Education, South Africa', doc_type: type, url: `https://example.org/${id}.pdf`, alternate_urls: [], edition: null, licence: 'Not yet confirmed',
    excerpts_permitted: false, checksum_sha256: verified ? 'ab'.repeat(32) : null, retrieved_on: verified ? '2026-10-03' : null, status: verified ? 'verified' : 'registered', note: null,
    verified_at: verified ? '2026-10-03T08:00:00Z' : null, created_at: '2026-10-01T08:00:00Z', indexed_on: '2026-10-01', content_reviewed_at: verified ? '2026-10-03T09:00:00Z' : null,
    content_review_note: null, jurisdiction: null, subject: null, grade_phase: null, isbn: null, licence_status: 'unreviewed', licence_reviewed_at: null, licence_review_note: null,
    retrieval_status: verified ? 'retrieved' : 'not_attempted', retrieval_size_bytes: null, retrieval_content_type: null, retrieval_final_url: null, retrieval_redirects: null, retrieval_recorded_at: null,
  });
  const sources = [
    source('caps', 'CAPS Mathematics Grades 4-6 (Intermediate Phase)', 'caps_policy'),
    source('atp', '2026 Annual Teaching Plan: Mathematics Grade 4', 'annual_teaching_plan'),
  ];

  await seedAuthenticatedSession(page, { role: role as 'teacher' });
  const platform = role === 'platform_administrator';
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: role as 'teacher', ...(platform ? { tenantId: null } : {}) }),
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
  const maybeObject = (route: Route, rows: unknown[]) =>
    (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows;

  await get('curriculum_versions', (r) =>
    maybeObject(r, [{ id: VERSION_ID, code: VERSION_CODE, name: 'Grade 4 Mathematics, Term 1 (2026 ATP reconciliation, DRAFT NOT VERIFIED)', status: 'draft', review_workflow: true }]),
  );
  await get('curriculum_sources', () => sources);
  await get('curriculum_open_questions', () => qState);
  await get('curriculum_formal_assessment_details', () => [formal]);
  await get('curriculum_objectives', () => objectives.map((o) => ({ id: o.id, code: o.code, description: o.description })));
  await get('curriculum_review_findings', () => findings);

  const rpc = (name: string, handler: (p: Record<string, unknown>, route: Route) => unknown) =>
    page.route(`**/rest/v1/rpc/${name}`, async (route) => handler(route.request().postDataJSON() as Record<string, unknown>, route));
  const rejected = (route: Route, message: string) => fulfillJson(route, { code: 'P0001', message, details: null, hint: null }, 400);
  const reviewOf = (type: string, id: string) => {
    const d = decisions.get(`${type}:${id}`);
    return d
      ? { decision: d.decision, stale: false, reviewer: '44444444-4444-4444-4444-444444444444', reviewed_at: '2026-10-03T10:00:00Z', notes: d.notes, source_id: d.source_id, source_section: d.source_section, source_page: d.source_page }
      : null;
  };
  const block = (type: keyof typeof TOTALS) => {
    const all = [...decisions.values()].filter((d) => d.entity === type);
    const positive = all.filter((d) => d.decision === 'verified' || d.decision === 'accepted').length;
    const needs = all.filter((d) => d.decision === 'needs_correction').length;
    const rej = all.filter((d) => d.decision === 'rejected').length;
    return { total: TOTALS[type], positive, needs_correction: needs, rejected: rej, pending: TOTALS[type] - positive - needs - rej };
  };

  await rpc('curriculum_review_summary', (_p, route) => {
    const open = qState.filter((q) => q.status === 'open').length;
    const deferred = qState.filter((q) => q.status === 'deferred');
    const blockers = ['27 objectives not reviewed yet'];
    return fulfillJson(route, {
      version_id: VERSION_ID, version_code: VERSION_CODE, version_name: 'Grade 4 Mathematics, Term 1 (2026 ATP reconciliation, DRAFT NOT VERIFIED)',
      version_status: 'draft', review_workflow: true, ready: false, overall: 'DRAFT — NOT VERIFIED', blockers,
      objective: block('objective'), lesson: block('lesson'), resource: block('resource'), assessment: block('assessment'), question: block('question'),
      open_questions: { total: 9, open, resolved: qState.filter((q) => q.status === 'resolved').length, deferred: deferred.length, deferred_material: deferred.filter((q) => q.materially_affects_scope).length },
      formal_assessment: { total: 1, details_recorded: formal.status === 'recorded' ? 1 : 0, verified: decisions.get('formal_assessment:o-fa01')?.decision === 'verified' ? 1 : 0 },
      open_findings: findings.filter((f) => f.status === 'open').length,
      sources: sources.map((s) => ({ id: s.id, title: s.title, doc_type: s.doc_type, evidence_level: verified ? 'content_reviewed' : 'indexed', licence_status: 'unreviewed', retrieval_status: s.retrieval_status })),
    });
  });
  await rpc('curriculum_review_items', (p, route) => {
    const type = String(p.p_type);
    const withReview = (rows: Array<{ id: string }>) => rows.map((r) => ({ ...r, review: reviewOf(type, r.id) }));
    const map: Record<string, Array<{ id: string }>> = { objective: objectives, lesson: lessons, resource: resources, assessment: assessments, question: questions };
    return fulfillJson(route, withReview(map[type] ?? []));
  });
  await rpc('record_curriculum_review', (p, route) => {
    calls.decisions.push(p);
    const positive = p.p_decision === 'verified' || p.p_decision === 'accepted';
    if (String(p.p_notes ?? '').trim().length < 3) return rejected(route, 'invalid_argument: reviewer notes are required');
    if (positive && (p.p_entity_type === 'objective' || p.p_entity_type === 'formal_assessment')) {
      if (!p.p_source_id) return rejected(route, 'invalid_argument: a verified objective needs the source it was checked against');
      if (!verified) return rejected(route, 'invalid_state: the source must have its identity verified before anything can be verified against it');
    }
    decisions.set(`${p.p_entity_type}:${p.p_entity_id}`, {
      entity: String(p.p_entity_type), id: String(p.p_entity_id), decision: String(p.p_decision), notes: String(p.p_notes),
      source_id: (p.p_source_id as string) ?? null, source_section: (p.p_source_section as string) ?? null, source_page: (p.p_source_page as string) ?? null,
    });
    if (!positive) findings.push({ id: `f-${findings.length + 1}`, version_id: VERSION_ID, entity_type: p.p_entity_type, entity_id: p.p_entity_id, category: p.p_finding_category ?? 'other', description: p.p_notes, status: 'open', review_id: 'rev', raised_by: 'u', raised_at: '2026-10-03T10:00:00Z', resolved_by: null, resolved_at: null, resolution_note: null });
    return fulfillJson(route, 'review-1');
  });
  await rpc('raise_review_finding', (p, route) => {
    calls.findings.push(p);
    findings.push({ id: `f-${findings.length + 1}`, version_id: VERSION_ID, entity_type: p.p_entity_type, entity_id: p.p_entity_id, category: p.p_category, description: p.p_description, status: 'open', review_id: null, raised_by: 'u', raised_at: '2026-10-03T10:00:00Z', resolved_by: null, resolved_at: null, resolution_note: null });
    return fulfillJson(route, 'finding-1');
  });
  await rpc('resolve_review_finding', (p, route) => {
    calls.resolvedFindings.push(p);
    const f = findings.find((x) => x.id === p.p_finding_id);
    if (f) Object.assign(f, { status: p.p_status, resolution_note: p.p_note, resolved_at: '2026-10-03T11:00:00Z' });
    return fulfillJson(route, null);
  });
  await rpc('resolve_open_question', (p, route) => {
    calls.questions.push(p);
    const q = qState.find((x) => x.id === p.p_question_id);
    if (!q) return rejected(route, 'not_found: no question');
    if (String(p.p_notes ?? '').trim().length < 3) return rejected(route, 'invalid_argument: an explanation is required for every change');
    if (p.p_status === 'resolved') {
      if (!p.p_source_id) return rejected(route, 'invalid_argument: a resolved question needs the source of the answer');
      if (!verified) return rejected(route, 'invalid_state: a question can only be resolved with evidence from a source whose identity is verified; defer it otherwise');
    }
    Object.assign(q, {
      status: p.p_status, answer: p.p_status === 'resolved' ? p.p_answer : null, source_id: p.p_status === 'resolved' ? p.p_source_id : null,
      source_section: p.p_source_section ?? null, source_page: p.p_source_page ?? null, notes: p.p_notes, resolved_by: 'u', resolved_at: '2026-10-03T10:00:00Z',
    });
    return fulfillJson(route, null);
  });
  await rpc('record_formal_assessment_details', (p, route) => {
    calls.formal.push(p);
    if (!verified) return rejected(route, 'invalid_state: official details can only be recorded from a source whose identity is verified');
    Object.assign(formal, {
      status: 'recorded', assessment_name: p.p_name, assessment_type: p.p_type, scope: p.p_scope, duration_minutes: p.p_duration_minutes, timing: p.p_timing, marks: p.p_marks,
      weighting: p.p_weighting, instructions: p.p_instructions, source_id: p.p_source_id, source_section: p.p_source_section, source_page: p.p_source_page, notes: p.p_notes,
    });
    return fulfillJson(route, null);
  });
  return { calls, decisions, findings, formal, qState };
}
