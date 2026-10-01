import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './mockData';

/** Network mocks for the teacher Learning screens, shared by the workflow and accessibility specs. */

export const V = 'version-1';
export const TOPIC_WN = 'topic-wn';
export const TOPIC_FRAC = 'topic-frac';

const objectives = [
  {
    id: 'obj-wn2',
    version_id: V,
    topic_id: TOPIC_WN,
    code: 'G4.MATH.T1.WN.02',
    description: 'Read, write and order whole numbers up to 10 000 using place value.',
    status: 'published',
    sort_order: 2,
    language: 'en',
    source_reference: null,
    subtopic_id: null,
  },
  {
    id: 'obj-wn3',
    version_id: V,
    topic_id: TOPIC_WN,
    code: 'G4.MATH.T1.WN.03',
    description: 'Compare whole numbers up to 10 000 and use the symbols <, > and = correctly.',
    status: 'published',
    sort_order: 3,
    language: 'en',
    source_reference: null,
    subtopic_id: null,
  },
  {
    id: 'obj-fr1',
    version_id: V,
    topic_id: TOPIC_FRAC,
    code: 'G4.MATH.T1.FRAC.01',
    description: 'Recognise and name common fractions as equal parts of a whole.',
    status: 'published',
    sort_order: 1,
    language: 'en',
    source_reference: null,
    subtopic_id: null,
  },
];

function resource(id: string, stage: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    lineage_id: id,
    version_number: 1,
    curriculum_version_id: V,
    grade_subject_id: 'gs1',
    topic_id: TOPIC_WN,
    stage,
    resource_kind: 'teacher_explanation',
    title,
    summary: `${title} summary`,
    difficulty: 'standard',
    language: 'en',
    estimated_minutes: 10,
    delivery_formats: ['text'],
    connectivity: 'none',
    device: 'teacher_device',
    projector_required: false,
    printable: false,
    cacheable: true,
    size_kb: 3,
    media_path: null,
    accessibility: {},
    origin: 'authored',
    ai_disclosure: null,
    status: 'published',
    body: {
      blocks: [
        { type: 'paragraph', text: `${title} body text` },
        { type: 'steps', items: ['First step', 'Second step'] },
      ],
    },
    ...extra,
  };
}

const resources = [
  resource('r-explain', 'explain', 'What each digit is worth'),
  resource('r-show', 'show', 'Place value chart', {
    printable: true,
    body: {
      blocks: [{ type: 'table', headers: ['Th', 'H', 'T', 'O'], rows: [['4', '3', '8', '2']] }],
      alt_text: 'A place value chart.',
    },
  }),
  resource('r-anim', 'show', 'Animated place value', {
    connectivity: 'low',
    projector_required: true,
    difficulty: 'advanced',
  }),
  resource('r-support', 'support', 'Support: build numbers with counters', {
    difficulty: 'foundational',
  }),
  resource('r-print', 'print', 'Printable worksheet', { printable: true, device: 'none' }),
];

const lesson = {
  id: 'lesson-1',
  lineage_id: 'lesson-1',
  version_number: 1,
  curriculum_version_id: V,
  grade_subject_id: 'gs1',
  topic_id: TOPIC_WN,
  title: 'Place value to 10 000',
  description: 'Learners read, write and order four-digit numbers.',
  estimated_minutes: 45,
  difficulty: 'standard',
  language: 'en',
  status: 'published',
  teacher_notes: 'Works with no projector and no devices.',
  learner_instructions: null,
  sort_order: 1,
  accessibility: {},
  origin: 'authored',
  ai_disclosure: null,
};

const assessment = {
  id: 'assess-1',
  curriculum_version_id: V,
  grade_subject_id: 'gs1',
  topic_id: TOPIC_WN,
  lesson_id: 'lesson-1',
  title: 'Quick check: place value to 10 000',
  purpose: 'formative',
  difficulty: 'standard',
  estimated_minutes: 10,
  mastery_percent: 80,
  support_below_percent: 50,
  language: 'en',
  status: 'published',
};
const questions = [1, 2, 3].map((n) => ({
  id: `q${n}`,
  assessment_id: 'assess-1',
  curriculum_version_id: V,
  position: n,
  question_type: 'numeric',
  prompt: `Question ${n}`,
  options: [],
  marks: n === 3 ? 2 : 2,
  objective_id: 'obj-wn2',
}));

const roster = [
  {
    learner_id: 'l1',
    first_name: 'Amahle',
    last_name: 'Nkosi',
    learner_number: 'LRN-1',
    status: 'needs_support',
    latest_percent: 33.33,
    evidence_count: 1,
    last_evidence_at: '2026-10-01T08:00:00Z',
  },
  {
    learner_id: 'l2',
    first_name: 'Bongani',
    last_name: 'Dlamini',
    learner_number: 'LRN-2',
    status: 'mastered',
    latest_percent: 100,
    evidence_count: 2,
    last_evidence_at: '2026-10-01T08:00:00Z',
  },
  {
    learner_id: 'l3',
    first_name: 'Chantelle',
    last_name: 'Botha',
    learner_number: 'LRN-3',
    status: 'not_started',
    latest_percent: null,
    evidence_count: 0,
    last_evidence_at: null,
  },
];

interface Calls {
  setTopic: unknown[];
  assign: unknown[];
  record: unknown[];
  generate: unknown[];
  recUpdate: unknown[];
  adopt: unknown[];
}

function eq(route: Route, column: string): string | null {
  const value = new URL(route.request().url()).searchParams.get(column);
  return value?.startsWith('eq.') ? value.slice(3) : null;
}

export async function mockLearning(page: Page, options: { adopted?: boolean; role?: string } = {}) {
  const { adopted = true, role = 'teacher' } = options;
  const calls: Calls = {
    setTopic: [],
    assign: [],
    record: [],
    generate: [],
    recUpdate: [],
    adopt: [],
  };
  let currentTopic: string | null = TOPIC_WN;
  let recommendations: Record<string, unknown>[] = [];

  await seedAuthenticatedSession(page, { role: role as 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: role as 'teacher' }),
    school: buildMockSchoolRow(),
  });
  await page.route('**/rest/v1/**', async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    if (/\/(profiles|schools|academic_years)$/.test(pathname)) return route.fallback();
    return fulfillJson(route, []);
  });

  const list = (pattern: string, rows: (route: Route) => unknown) =>
    page.route(`**/rest/v1/${pattern}*`, async (route) =>
      route.request().method() === 'GET' ? fulfillJson(route, rows(route)) : route.fallback(),
    );

  await list('school_curriculum_adoptions', () =>
    adopted ? [{ curriculum_version_id: V, status: 'active' }] : [],
  );
  await list('school_grade_curriculum_map', () =>
    adopted
      ? [{ school_grade_id: 'g4', curriculum_version_id: V, curriculum_grade_id: 'cg4' }]
      : [],
  );
  await list('school_subject_curriculum_map', () =>
    adopted
      ? [
          {
            school_subject_id: 'subj-math',
            curriculum_version_id: V,
            curriculum_subject_id: 'cs-math',
          },
        ]
      : [],
  );
  await list('classes', () => [{ id: 'class-4a', name: 'Grade 4A', grade_id: 'g4', active: true }]);
  await list('subjects', () => [{ id: 'subj-math', name: 'Mathematics', active: true }]);
  await list('class_teacher_assignments', () => [
    { class_id: 'class-4a', subject_id: 'subj-math', active: true },
  ]);
  await list('curriculum_grade_subjects', () => [{ id: 'gs1' }]);
  await list('curriculum_terms', () => [{ id: 'term-1', term_number: 1 }]);
  await list('curriculum_topics', () => [
    {
      id: TOPIC_WN,
      code: 'G4.MATH.T1.WN',
      title: 'Whole numbers: counting, place value and comparing',
      term_id: 'term-1',
      sort_order: 1,
      status: 'published',
    },
    {
      id: TOPIC_FRAC,
      code: 'G4.MATH.T1.FRAC',
      title: 'Common fractions',
      term_id: 'term-1',
      sort_order: 3,
      status: 'published',
    },
  ]);
  await page.route('**/rest/v1/class_topic_plans*', async (route) =>
    fulfillJson(route, currentTopic ? { topic_id: currentTopic, status: 'in_progress' } : null),
  );
  await list('curriculum_objectives', (r) =>
    objectives.filter((o) => o.topic_id === eq(r, 'topic_id')),
  );
  await list('lessons', (r) => (eq(r, 'topic_id') === TOPIC_WN ? [lesson] : []));
  await list('teaching_resources', (r) => (eq(r, 'topic_id') === TOPIC_WN ? resources : []));
  await list('learning_assessments', (r) => (eq(r, 'topic_id') === TOPIC_WN ? [assessment] : []));
  await list('lesson_objectives', () => [
    { lesson_id: 'lesson-1', objective_id: 'obj-wn2' },
    { lesson_id: 'lesson-1', objective_id: 'obj-wn3' },
  ]);
  await list('lesson_resources', () =>
    resources.map((r, i) => ({ lesson_id: 'lesson-1', resource_id: r.id, sort_order: i })),
  );
  await list('learning_activities', () => [
    {
      id: 'act-1',
      lesson_id: 'lesson-1',
      curriculum_version_id: V,
      title: 'Build and read numbers',
      instructions: 'In groups, build each number card with bundles.',
      activity_type: 'group_work',
      grouping: 'small_group',
      difficulty: 'standard',
      estimated_minutes: 15,
      resource_id: null,
      sort_order: 1,
    },
  ]);
  await list('assessment_objectives', () => [
    { assessment_id: 'assess-1', objective_id: 'obj-wn2' },
  ]);
  await list('assessment_questions', () => questions);
  await list('learning_recommendations', () => recommendations);
  await list('curriculum_versions', () => [
    {
      id: V,
      code: 'ZA-CAPS-G4-MATH-SLICE',
      name: 'CAPS Grade 4 Mathematics (Term 1 slice)',
      status: 'published',
    },
  ]);
  await list('grades', () => [{ id: 'g4', name: 'Grade 4', sort_order: 4, active: true }]);
  await list('curriculum_grades', () => [
    { id: 'cg4', version_id: V, name: 'Grade 4', sort_order: 4 },
  ]);
  await list('curriculum_subjects', () => [
    { id: 'cs-math', version_id: V, name: 'Mathematics', sort_order: 1 },
  ]);

  const rpc = (name: string, handler: (payload: unknown) => unknown) =>
    page.route(`**/rest/v1/rpc/${name}`, async (route) =>
      fulfillJson(route, handler(route.request().postDataJSON() as unknown)),
    );
  await rpc('set_class_current_topic', (p) => {
    calls.setTopic.push(p);
    currentTopic = (p as { p_topic_id: string }).p_topic_id;
    return 'plan-1';
  });
  await rpc('assign_learning_to_class', (p) => (calls.assign.push(p), 'assignment-1'));
  await rpc(
    'record_learning_attempt',
    (p) => (calls.record.push(p), { id: 'attempt', percent: 83.33 }),
  );
  await rpc('class_objective_progress', () => roster);
  await rpc('generate_learning_recommendations', (p) => {
    calls.generate.push(p);
    recommendations = [
      {
        id: 'rec-1',
        school_id: 's',
        learner_id: 'l1',
        objective_id: 'obj-wn2',
        kind: 'remediation',
        resource_id: 'r-support',
        reason: 'Recorded results: the latest is 33.33% across 1 recorded attempt.',
        evidence: {},
        status: 'open',
        intervention_id: null,
        created_at: '2026-10-01T08:00:00Z',
        resolved_at: null,
      },
    ];
    return 1;
  });
  await rpc('update_recommendation_status', (p) => {
    calls.recUpdate.push(p);
    recommendations = [];
    return null;
  });
  await rpc('adopt_curriculum_version', (p) => (calls.adopt.push(p), 'adoption-1'));
  return calls;
}
