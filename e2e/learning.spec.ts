import { test, expect } from '@playwright/test';
import { mockLearning, TOPIC_FRAC, TOPIC_WN, V } from './utils/learningMocks';

/**
 * Teacher workflow for Funda360 Learning, against a mocked network:
 * select class -> current topic -> toolkit -> assign -> record results -> who needs help -> suggestions.
 */

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
  // Evidence (what was recorded) and suggestion (what to consider) are separate statements.
  await expect(
    suggestions.getByText(
      'Evidence: Recorded results: the latest is 33.33% across 1 recorded attempt.',
    ),
  ).toBeVisible();
  await expect(
    suggestions.getByText(
      'Suggestion: Consider using “Support: build numbers with counters” before the next check.',
    ),
  ).toBeVisible();
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
