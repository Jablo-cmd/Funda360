import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

/**
 * Funda AI shell. The gateway and data are mocked here; the policy gate,
 * data isolation and audit are proven against a real stack by
 * supabase/stack-tests/funda-ai.mjs and the RLS suite (zzzz_funda_ai).
 */

const FEATURE = {
  key: 'copilot',
  name: 'Funda AI Copilot',
  description: 'Answers questions about the data you can already see.',
};

const ANSWER = {
  kind: 'answer',
  request_id: '9a000000-0000-4000-8000-000000000001',
  conversation_id: null,
  answer: 'Thabo attended 18 of 20 school days this term.',
  evidence: [
    {
      claim: 'Attendance rate',
      value: '90%',
      period: 'Term 3',
      source_tool_call: 'toolu_1',
      source_field: 'attendance_rate_percent',
      verified: true,
      reason: 'verified',
    },
    {
      claim: 'Class average',
      value: '84%',
      period: 'Term 3',
      source_tool_call: 'toolu_9',
      source_field: 'average_percent',
      verified: false,
      reason: 'unknown_tool_call',
    },
  ],
  limitations: ['Two school days have no register yet.'],
  confidence: 'low',
  follow_up_questions: [],
  declined_actions: ['Changing marks is done by the subject teacher in Assessments.'],
  tools_used: [
    { tool: 'get_learner_attendance_summary', status: 'ok' },
    { tool: 'get_learner_fee_summary', status: 'denied' },
  ],
  requires_human_review: false,
  answer_withheld: false,
  unsupported_figures: [],
  generated_by: {
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    prompt: 'school_copilot',
    prompt_version: 1,
  },
};

async function signIn(page: Page, features: unknown[] = [FEATURE]) {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await page.route('**/rest/v1/rpc/**', async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/ai_my_features')) return fulfillJson(route, features);
    if (pathname.endsWith('/ai_submit_feedback')) return route.fallback();
    return fulfillJson(route, []);
  });
}

async function mockGateway(
  page: Page,
  respond: (body: Record<string, unknown>) => { status: number; body: unknown },
) {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/functions/v1/funda-ai', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    const { status, body: out } = respond(body);
    return fulfillJson(route, out, status);
  });
  return requests;
}

test('the launcher is hidden when Funda AI is not switched on', async ({ page }) => {
  await signIn(page, []);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Open Funda AI' })).toHaveCount(0);
});

test('a principal asks a question and sees evidence, verification, limitations and feedback', async ({
  page,
}) => {
  await signIn(page);
  const requests = await mockGateway(page, () => ({ status: 200, body: ANSWER }));
  const feedback: Record<string, unknown>[] = [];
  await page.route('**/rest/v1/rpc/ai_submit_feedback', async (route) => {
    feedback.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open Funda AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'Funda AI' });
  await expect(dialog.getByText('never changes records')).toBeVisible();
  await expect(dialog.getByText('Try asking')).toBeVisible();

  await dialog.getByLabel('Ask Funda AI').fill('How is Thabo doing with attendance?');
  await dialog.getByRole('button', { name: 'Ask', exact: true }).click();

  const card = dialog.getByRole('article', { name: 'Funda AI answer' });
  await expect(card.getByText('Thabo attended 18 of 20 school days this term.')).toBeVisible();
  await expect(card.getByText('Low confidence')).toBeVisible();
  await expect(card.getByText('Matches Funda360 data')).toBeVisible();
  await expect(card.getByText('Rejected: does not match the cited data')).toBeVisible();
  await expect(card.getByText('Two school days have no register yet.')).toBeVisible();
  await expect(
    card.getByText('Changing marks is done by the subject teacher in Assessments.'),
  ).toBeVisible();
  await expect(card.getByText('Looked up: Attendance summary.')).toBeVisible();
  await expect(card.getByText('Not available to you: Fee account.')).toBeVisible();

  expect(requests[0]).toMatchObject({
    feature: 'copilot',
    message: 'How is Thabo doing with attendance?',
    history: [],
  });
  expect(Object.keys(requests[0]).sort()).toEqual([
    'client_request_id',
    'feature',
    'history',
    'message',
  ]);

  await card.getByRole('button', { name: 'Helpful', exact: true }).click();
  await expect(card.getByText('Thanks for the feedback.')).toBeVisible();
  expect(feedback[0]).toMatchObject({ p_request_id: ANSWER.request_id, p_rating: 'helpful' });

  // A follow-up carries only the previous question and answer text.
  await dialog.getByLabel('Ask Funda AI').fill('And last term?');
  await dialog.getByLabel('Ask Funda AI').press('Enter');
  await expect(dialog.getByRole('article', { name: 'Funda AI answer' })).toHaveCount(2);
  expect(requests[1].history).toEqual([
    { role: 'user', text: 'How is Thabo doing with attendance?' },
    { role: 'assistant', text: ANSWER.answer },
  ]);

  await dialog
    .getByRole('article', { name: 'Funda AI answer' })
    .nth(1)
    .getByRole('button', { name: 'Report a problem' })
    .click();
  await dialog
    .getByLabel('What is wrong with this answer? (optional)')
    .fill('The figure is out of date');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog.getByText('Thanks. The problem has been reported.')).toBeVisible();
  expect(feedback[1]).toMatchObject({
    p_rating: 'problem',
    p_comment: 'The figure is out of date',
  });
});

test('a safeguarding disclosure shows the fixed guidance', async ({ page }) => {
  await signIn(page);
  await mockGateway(page, () => ({
    status: 200,
    body: {
      kind: 'safeguarding',
      request_id: '9a000000-0000-4000-8000-000000000002',
      message: 'Inform the designated safeguarding lead without delay.',
    },
  }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open Funda AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'Funda AI' });
  await dialog.getByLabel('Ask Funda AI').fill('A learner told me something worrying');
  await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Inform the designated safeguarding lead without delay.',
  );
});

test('an answer with unverified figures is withheld and says why', async ({ page }) => {
  await signIn(page);
  await mockGateway(page, () => ({
    status: 200,
    body: {
      ...ANSWER,
      answer:
        "Funda AI's answer included figures that could not be matched to your Funda360 data, so it is not shown.",
      answer_withheld: true,
      unsupported_figures: ['15%'],
    },
  }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open Funda AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'Funda AI' });
  await dialog.getByLabel('Ask Funda AI').fill('How is attendance?');
  await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
  const card = dialog.getByRole('article', { name: 'Funda AI answer' });
  await expect(card.getByRole('alert')).toContainText('Answer not shown');
  await expect(card.getByRole('alert')).toContainText('Figures that could not be checked: 15%');
  await expect(card.getByText('Thabo attended 18 of 20 school days this term.')).toHaveCount(0);
});

test('a medical question gets the policy notice, not an answer', async ({ page }) => {
  await signIn(page);
  await mockGateway(page, () => ({
    status: 200,
    body: {
      kind: 'policy_notice',
      request_id: '9a000000-0000-4000-8000-000000000003',
      message: 'Funda AI does not handle medical or health information.',
    },
  }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open Funda AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'Funda AI' });
  await dialog.getByLabel('Ask Funda AI').fill('Is his medication working?');
  await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Not something Funda AI can help with' }),
  ).toContainText('Funda AI does not handle medical or health information.');
  await expect(dialog.getByRole('article', { name: 'Funda AI answer' })).toHaveCount(0);
});

test('gateway errors become plain-language messages', async ({ page }) => {
  await signIn(page);
  const codes = [
    [503, 'ai_provider_not_configured', 'has not been connected to an AI provider yet'],
    [429, 'rate_limited', 'Wait a minute and try again'],
    [403, 'school_not_enabled', 'not switched on for your school'],
  ] as const;
  let i = 0;
  await mockGateway(page, () => {
    const [status, error] = codes[i++];
    return { status, body: { error, request_id: null } };
  });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open Funda AI' }).click();
  const dialog = page.getByRole('dialog', { name: 'Funda AI' });
  for (const [, , text] of codes) {
    await dialog.getByLabel('Ask Funda AI').fill('Question');
    await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(dialog.getByRole('alert').last()).toContainText(text);
  }
});

test('the launcher and panel fit a 320px phone and pass axe', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signIn(page);
  await mockGateway(page, () => ({ status: 200, body: ANSWER }));
  await page.goto('/dashboard');
  const launcher = page.getByRole('button', { name: 'Open Funda AI' });
  await expect(launcher).toBeVisible();
  const box = await launcher.boundingBox();
  expect(box && box.width >= 44 && box.height >= 44).toBeTruthy();
  const overflow = await page.evaluate(() => {
    const header = document.querySelector('header');
    return header ? header.scrollWidth - header.clientWidth : 0;
  });
  expect(overflow).toBeLessThanOrEqual(0);

  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Funda AI' });
  await dialog.getByLabel('Ask Funda AI').fill('How is attendance?');
  await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(dialog.getByRole('article', { name: 'Funda AI answer' })).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 320).toBeTruthy();

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
