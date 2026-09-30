import { test, expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

/**
 * Teacher workflow for Funda360 Learning, against a mocked network:
 * select class -> current topic -> toolkit -> assign -> record results -> who needs help -> suggestions.
 */

const V = 'version-1';
const TOPIC_WN = 'topic-wn';
const TOPIC_FRAC = 'topic-frac';

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

async function mockLearning(page: Page, options: { adopted?: boolean; role?: string } = {}) {
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
        reason:
          'Latest recorded result is 33.33%, below the support threshold (1 attempt(s) recorded).',
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

test('a teacher sees their class, current topic, objectives, lesson and the toolkit', async ({
  page,
}) => {
  await mockLearning(page);
  await page.goto('/learning');

  await expect(page.getByRole('heading', { name: 'Learning', level: 1 })).toBeVisible();
  await expect(page.getByLabel('Class and subject')).toHaveValue(/class-4a/);
  await expect(page.getByLabel('Current topic')).toHaveValue(TOPIC_WN);
  await expect(
    page.getByText('Read, write and order whole numbers up to 10 000 using place value.').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Place value to 10 000', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Build and read numbers')).toBeVisible();

  // Toolkit tabs carry counts and every stage is present.
  for (const label of [
    'Explain (1)',
    'Show (2)',
    'Try (0)',
    'Practise (0)',
    'Check (0)',
    'Support (1)',
    'Challenge (0)',
    'Print (1)',
  ]) {
    await expect(page.getByRole('button', { name: label })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'What each digit is worth' })).toBeVisible();
  await expect(page.getByText('Works offline').first()).toBeVisible();
  await expect(page.getByText('No projector needed').first()).toBeVisible();
});

test('toolkit resources say what they need, and open as readable content', async ({ page }) => {
  await mockLearning(page);
  await page.goto('/learning');

  await page.getByRole('button', { name: 'Show (2)' }).click();
  const animation = page.locator('li', { hasText: 'Animated place value' });
  await expect(animation.getByText('Needs a projector')).toBeVisible();
  await expect(animation.getByText('Needs a little data')).toBeVisible();
  const chart = page.locator('li', { hasText: 'Place value chart' });
  await expect(chart.getByText('Printable')).toBeVisible();

  await chart.getByRole('button', { name: /Open/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Place value chart' });
  await expect(dialog.getByRole('columnheader', { name: 'Th' })).toBeVisible();
  await expect(dialog.getByText('Picture description: A place value chart.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Print' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Support (1)' }).click();
  await expect(
    page.getByRole('heading', { name: 'Support: build numbers with counters' }),
  ).toBeVisible();
  await expect(page.getByText('Foundation').first()).toBeVisible();
});

test('printing an open resource prints only that resource', async ({ page }) => {
  await mockLearning(page);
  await page.goto('/learning');
  await page.getByRole('button', { name: 'Show (2)' }).click();
  await page
    .locator('li', { hasText: 'Place value chart' })
    .getByRole('button', { name: /Open/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Place value chart' });
  await expect(dialog).toBeVisible();

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Th' })).toBeVisible();
  await expect(dialog.getByRole('button')).toHaveCount(0);
});

test('choosing a topic sets it as the current topic and shows an empty state when it has no lessons yet', async ({
  page,
}) => {
  const calls = await mockLearning(page);
  await page.goto('/learning');

  await page.getByLabel('Current topic').selectOption(TOPIC_FRAC);
  await expect(page.getByText('Current topic updated for this class.')).toBeVisible();
  expect(calls.setTopic).toEqual([
    { p_class_id: 'class-4a', p_school_subject_id: 'subj-math', p_topic_id: TOPIC_FRAC },
  ]);
  await expect(page.getByRole('heading', { name: 'No lessons for this topic yet' })).toBeVisible();
  await expect(
    page.getByText('Recognise and name common fractions as equal parts of a whole.').first(),
  ).toBeVisible();
});

test('a teacher assigns the lesson to their class with a due date', async ({ page }) => {
  const calls = await mockLearning(page);
  await page.goto('/learning');

  await page.getByRole('button', { name: 'Assign this lesson to Grade 4A' }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign to Grade 4A' });
  await dialog.getByLabel('Due date (optional)').fill('2026-10-09');
  await dialog.getByLabel('Note for the class (optional)').fill('Finish the practice set');
  await dialog.getByRole('button', { name: 'Assign' }).click();

  await expect(page.getByText('Assigned to Grade 4A.')).toBeVisible();
  expect(calls.assign).toHaveLength(1);
  const payload = calls.assign[0] as Record<string, unknown>;
  expect(payload).toMatchObject({
    p_class_id: 'class-4a',
    p_school_subject_id: 'subj-math',
    p_lesson_id: 'lesson-1',
    p_assessment_id: null,
    p_instructions: 'Finish the practice set',
  });
  expect(String(payload.p_due_at)).toMatch(/^2026-10-09T/);
});

test('recording results validates scores, saves only the rows entered, and reloads who needs help', async ({
  page,
}) => {
  const calls = await mockLearning(page);
  await page.goto('/learning');

  await page.getByRole('button', { name: 'Record results' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record results' });
  await expect(dialog.getByText('marked out of 6')).toBeVisible();
  const save = dialog.getByRole('button', { name: /Save/ });
  await expect(save).toBeDisabled();

  await dialog.getByLabel(/Amahle Nkosi/).fill('9');
  await expect(dialog.getByText('Enter a score from 0 to 6.')).toBeVisible();
  await expect(save).toBeDisabled();

  await dialog.getByLabel(/Amahle Nkosi/).fill('2');
  await dialog.getByLabel(/Bongani Dlamini/).fill('5,5');
  await expect(save).toHaveText('Save 2 results');
  await save.click();

  await expect(page.getByText('Saved 2 results.')).toBeVisible();
  expect(calls.record).toEqual([
    { p_learner_id: 'l1', p_assessment_id: 'assess-1', p_score: 2 },
    { p_learner_id: 'l2', p_assessment_id: 'assess-1', p_score: 5.5 },
  ]);
  await expect(dialog).toHaveCount(0);
});

test('the class view shows who understands and who needs help, without relying on colour', async ({
  page,
}) => {
  await mockLearning(page);
  await page.goto('/learning');

  const summary = page.getByRole('list', { name: 'Class summary' });
  await expect(summary.getByText('1 mastered')).toBeVisible();
  await expect(summary.getByText('1 needs support')).toBeVisible();
  await expect(summary.getByText('1 not started')).toBeVisible();
  await expect(page.getByText('Amahle Nkosi')).toBeVisible();
  await expect(
    page.locator('li', { hasText: 'Amahle Nkosi' }).getByText('Needs support'),
  ).toBeVisible();
  await expect(
    page.locator('li', { hasText: 'Bongani Dlamini' }).getByText('Mastered'),
  ).toBeVisible();
  await expect(
    page.locator('li', { hasText: 'Bongani Dlamini' }).getByText('2 tries'),
  ).toBeVisible();
});

test('suggested next steps come from recorded results and can be accepted', async ({ page }) => {
  const calls = await mockLearning(page);
  await page.goto('/learning');

  await page.getByRole('button', { name: 'Suggest next steps' }).click();
  await expect(page.getByText('1 new suggestion based on recorded results.')).toBeVisible();
  expect(calls.generate).toEqual([{ p_class_id: 'class-4a', p_objective_id: 'obj-wn2' }]);

  const suggestions = page.getByRole('list', { name: 'Suggested next steps' });
  await expect(suggestions.getByText('Amahle Nkosi: needs support')).toBeVisible();
  await expect(suggestions.getByText('Try: Support: build numbers with counters')).toBeVisible();
  await expect(
    page.getByText('Suggestions come only from results you have recorded. Nothing is predicted.'),
  ).toBeVisible();

  await suggestions.getByRole('button', { name: /Accept/ }).click();
  await expect.poll(() => calls.recUpdate).toEqual([{ p_id: 'rec-1', p_status: 'accepted' }]);
  await expect(suggestions).toHaveCount(0);
});

test('a teacher whose school has not connected the curriculum is told what to do, without a setup link', async ({
  page,
}) => {
  await mockLearning(page, { adopted: false });
  await page.goto('/learning');
  await expect(page.getByRole('heading', { name: 'Nothing to teach from yet' })).toBeVisible();
  await expect(page.getByText('Ask your school administrator')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set up the curriculum' })).toHaveCount(0);
});

test('a principal can set up the curriculum: adopt a version and connect grades and subjects', async ({
  page,
}) => {
  const calls = await mockLearning(page, { adopted: false, role: 'principal' });
  await page.goto('/learning');
  await expect(page.getByRole('link', { name: 'Set up the curriculum' })).toBeVisible();
  await page.getByRole('link', { name: 'Set up the curriculum' }).click();

  await expect(page.getByRole('heading', { name: 'Curriculum setup', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Use this curriculum' }).click();
  await expect.poll(() => calls.adopt).toHaveLength(1);
  expect(calls.adopt[0]).toMatchObject({ p_version_id: V });
});

test('a role without learning access is sent away from /learning', async ({ page }) => {
  await mockLearning(page, { role: 'receptionist' });
  await page.goto('/learning');
  await expect(page).not.toHaveURL(/\/learning$/);
});

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the whole teaching flow fits the screen with no sideways scrolling', async ({ page }) => {
    await mockLearning(page);
    await page.goto('/learning');
    await expect(
      page.getByRole('heading', { name: 'Place value to 10 000', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('list', { name: 'Class summary' })).toBeVisible();

    const overflow = () =>
      page.evaluate(() => {
        const main = document.querySelector('main');
        return {
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          main: main ? main.scrollWidth - main.clientWidth : 0,
        };
      });
    expect(await overflow()).toEqual({ doc: 0, main: 0 });

    await page.getByRole('button', { name: 'Show (2)' }).click();
    await page
      .locator('li', { hasText: 'Place value chart' })
      .getByRole('button', { name: /Open/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Place value chart' });
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Record results' }).click();
    const results = page.getByRole('dialog', { name: 'Record results' });
    const rbox = await results.boundingBox();
    expect(rbox!.x + rbox!.width).toBeLessThanOrEqual(320);
    for (const input of await results.locator('input').all()) {
      const size = await input.boundingBox();
      expect(size!.height).toBeGreaterThanOrEqual(44);
      expect(
        await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
  });
});
