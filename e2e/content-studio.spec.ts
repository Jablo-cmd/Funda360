import { test, expect } from '@playwright/test';
import { mockStudio, LESSON, TOPIC, VERSION } from './utils/studioMocks';

/** Content Studio for platform administrators, against a mocked network. */

async function chooseTopicAndObjective(page: import('@playwright/test').Page) {
  await page.getByLabel('Curriculum version').selectOption(VERSION);
  await page.getByLabel(/^Topic/).selectOption(TOPIC);
}

test('a platform administrator sees the studio; a teacher cannot open it', async ({ page }) => {
  await mockStudio(page);
  await page.goto('/content-studio');
  await expect(page.getByRole('heading', { name: 'Content Studio', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ask for an AI draft' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(
    page.getByText('Nothing reaches teachers until a person has reviewed it'),
  ).toBeVisible();
});

test('a teacher is turned away from the studio', async ({ page }) => {
  await mockStudio(page, { role: 'teacher' });
  await page.goto('/content-studio');
  await expect(page).not.toHaveURL(/content-studio/);
});

test('only approved objectives can be drafted, and the draft is created as a draft', async ({
  page,
}) => {
  const { calls } = await mockStudio(page);
  await page.goto('/content-studio');
  await chooseTopicAndObjective(page);

  const draftObjective = page.getByLabel(/AI\.O2: .*not approved yet/);
  await expect(draftObjective).toBeDisabled();
  const create = page.getByRole('button', { name: 'Create AI draft' });
  await expect(create).toBeDisabled();
  await page.getByLabel(/AI\.O1: Count forward in hundreds/).check();
  await page.getByLabel('Note for the drafter (optional)').fill('Use farm animals');
  await expect(create).toBeEnabled();
  await create.click();

  await expect(page.getByRole('status').filter({ hasText: 'Draft created.' })).toBeVisible();
  await expect(
    page.getByText('Nobody else can see it until it has been reviewed and published.'),
  ).toBeVisible();
  await expect
    .poll(() => calls.draft)
    .toEqual([
      { versionId: VERSION, topicId: TOPIC, objectiveIds: ['o1'], instruction: 'Use farm animals' },
    ]);

  await page.getByRole('button', { name: 'Review the new lesson' }).click();
  await expect(page.getByRole('dialog', { name: /Lesson: Counting in hundreds/ })).toBeVisible();
});

test('refused AI output is reported and nothing is saved', async ({ page }) => {
  const { state } = await mockStudio(page);
  state.functionMode = 'rejected';
  await page.goto('/content-studio');
  await chooseTopicAndObjective(page);
  await page.getByLabel(/AI\.O1/).check();
  await page.getByRole('button', { name: 'Create AI draft' }).click();
  await expect(page.getByText('The AI’s reply was refused and nothing was saved')).toBeVisible();
  await expect(page.getByText('resource 2 has an unknown stage')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review the new lesson' })).toHaveCount(0);
});

test('provider failure, missing configuration and missing permission are explained plainly', async ({
  page,
}) => {
  const { state } = await mockStudio(page);
  await page.goto('/content-studio');
  await chooseTopicAndObjective(page);
  await page.getByLabel(/AI\.O1/).check();

  state.functionMode = 'failed';
  await page.getByRole('button', { name: 'Create AI draft' }).click();
  await expect(
    page.getByText('The draft could not be created and nothing was saved.'),
  ).toBeVisible();
  await expect(page.getByText('The AI service took too long to answer.')).toBeVisible();

  state.functionMode = 'not_configured';
  await page.getByRole('button', { name: 'Create AI draft' }).click();
  await expect(page.getByRole('alert')).toHaveText('AI drafting is not set up on this server yet.');

  state.functionMode = 'forbidden';
  await page.getByRole('button', { name: 'Create AI draft' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Only platform administrators can create AI drafts.',
  );
});

test('a reviewer can read, check, acknowledge, link a source, verify and move the unit along', async ({
  page,
}) => {
  const { calls, state } = await mockStudio(page);
  await page.goto('/content-studio');
  await page.getByRole('button', { name: 'Review Counting in hundreds', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Lesson: Counting in hundreds/ });

  // What the reviewer reads and where it came from.
  await expect(dialog.getByText('Learners count forward and backward in hundreds.')).toBeVisible();
  await expect(dialog.getByText('Start with bundles of sticks.')).toBeVisible();
  await expect(dialog.getByText('mock-model-1 (mock), prompt lesson-pack-v1')).toBeVisible();
  await expect(dialog.getByText('Not checked against curriculum documents').first()).toBeVisible();
  await expect(dialog.getByText('Not approved yet')).toBeVisible();
  await expect(dialog.getByText('Checks have not been run yet.')).toBeVisible();

  // Checks produce findings; severity is spelled out, not colour only.
  await dialog.getByRole('button', { name: 'Run checks' }).click();
  await expect.poll(() => calls.validate).toEqual([{ p_entity: 'lessons', p_id: LESSON }]);
  const findings = dialog.getByRole('list', { name: 'Findings' });
  await expect(findings.getByText('✕ Error')).toBeVisible();
  await expect(findings.getByText('! Warning')).toBeVisible();
  await expect(findings.getByText('i Note')).toBeVisible();
  await expect(dialog.getByText('1 error to fix before this can be approved.')).toBeVisible();
  await expect(findings.getByRole('button', { name: 'Acknowledge' })).toBeDisabled();
  await findings.getByLabel('Why is this acceptable?').fill('Claim removed in teaching');
  await findings.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(findings.getByText('✓ Acknowledged: Claim removed in teaching')).toBeVisible();
  await expect
    .poll(() => calls.acknowledge)
    .toEqual([{ p_finding_id: 'f-warn', p_note: 'Claim removed in teaching' }]);
  // Errors can never be acknowledged: they offer no button.
  await expect(
    findings.getByText('Contains a web link.').locator('xpath=ancestor::li').getByRole('button'),
  ).toHaveCount(0);

  // Source reference, check, verification.
  await dialog.getByLabel(/^Source/).selectOption('src-1');
  await dialog.getByLabel('Where in the source (page or section)').fill('Term 1 whole numbers');
  await dialog.getByRole('button', { name: 'Add reference' }).click();
  await expect(dialog.getByText('Term 1 whole numbers')).toBeVisible();
  await expect
    .poll(() => calls.references)
    .toEqual([
      {
        p_entity: 'lessons',
        p_id: LESSON,
        p_source_id: 'src-1',
        p_locator: 'Term 1 whole numbers',
        p_supports: null,
      },
    ]);
  await dialog.getByRole('button', { name: 'Save check' }).click();
  await expect(dialog.getByText('✓ Checked: matches')).toBeVisible();
  await dialog.getByLabel('Verification level').selectOption('reviewed');
  await dialog.getByRole('button', { name: 'Save verification' }).click();
  await expect(dialog.getByText('Now: Reviewed against its sources by a person.')).toBeVisible();
  await expect
    .poll(() => calls.verifications)
    .toEqual([{ p_entity: 'lessons', p_id: LESSON, p_status: 'reviewed', p_note: null }]);

  // Workflow: the database decides. A rejection is shown as the sentence it raised, not as "invitation" copy.
  await dialog.getByRole('button', { name: 'Submit for review' }).click();
  await expect
    .poll(() => calls.transitions)
    .toEqual([{ p_entity: 'lesson', p_id: LESSON, p_to: 'review', p_note: null }]);
  await expect(dialog.getByRole('button', { name: 'Approve' })).toBeVisible();
  state.transitionError =
    'invalid_state: AI-assisted content needs a passing validation run before it can be approved';
  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'AI-assisted content needs a passing validation run before it can be approved.',
  );
  await expect(dialog.getByRole('alert')).not.toContainText(/invitation/i);

  state.transitionError = null;
  await dialog.getByRole('button', { name: 'Approve' }).click();
  await expect(dialog.getByText('Second Admin on')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Publish to teachers' })).toBeVisible();
});

test('the studio never claims curriculum alignment', async ({ page }) => {
  await mockStudio(page);
  await page.goto('/content-studio');
  await page.getByRole('button', { name: 'Review Counting in hundreds', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Where this came from')).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/caps[- ]aligned|caps compliant|curriculum aligned|fully aligned/i);
  const dialogText = await dialog.innerText();
  expect(dialogText).not.toMatch(
    /caps[- ]aligned|caps compliant|curriculum aligned|fully aligned/i,
  );
});

test('resources and assessments are reviewed with their content, and AI answer keys are labelled as such', async ({
  page,
}) => {
  await mockStudio(page);
  await page.goto('/content-studio');

  await page.getByRole('button', { name: 'Resources' }).click();
  await page.getByRole('button', { name: 'Review Counting in hundreds: explain' }).click();
  const resource = page.getByRole('dialog', { name: /Resource: Counting in hundreds: explain/ });
  await expect(resource.getByText('Say: we count in hundreds. 100, 200, 300.')).toBeVisible();
  await expect(resource.getByText('Works offline').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(resource).toHaveCount(0);

  await page.getByRole('button', { name: 'Assessments' }).click();
  await page.getByRole('button', { name: 'Review Counting in hundreds: quick check' }).click();
  const assessment = page.getByRole('dialog', {
    name: /Assessment: Counting in hundreds: quick check/,
  });
  await expect(assessment.getByText('What comes after 100?')).toBeVisible();
  await expect(assessment.getByText('Answer proposed by the AI (check it):')).toBeVisible();
});

test('sources are registered with details only, then verified', async ({ page }) => {
  const { calls } = await mockStudio(page);
  await page.goto('/content-studio');
  const sources = page.getByRole('list', { name: 'Registered sources' });
  await expect(sources.getByText('Registered, not yet verified')).toBeVisible();

  await page.getByLabel(/^Title/).fill('Annual teaching plan Grade 4 (test)');
  await page.getByLabel(/^Publisher/).fill('Test publisher');
  await page.getByLabel('Licence or permission to use it').fill('Used under a test licence');
  await page.getByRole('button', { name: 'Register source' }).click();
  await expect.poll(() => calls.registered).toHaveLength(1);
  expect(calls.registered[0]).toMatchObject({
    p_title: 'Annual teaching plan Grade 4 (test)',
    p_publisher: 'Test publisher',
    p_doc_type: 'caps_policy',
  });

  await sources
    .getByRole('button', { name: 'Mark Mathematics policy statement (test) as verified' })
    .click();
  await expect.poll(() => calls.sourcesVerified).toHaveLength(1);
  await expect(sources.getByText('✓ Verified as the authoritative edition')).toBeVisible();
});

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the studio and its review dialog fit the screen, with large touch targets', async ({
    page,
  }) => {
    await mockStudio(page);
    await page.goto('/content-studio');
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
    const overflow = () =>
      page.evaluate(() => {
        const main = document.querySelector('main');
        return {
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          main: main ? main.scrollWidth - main.clientWidth : 0,
        };
      });
    expect(await overflow()).toEqual({ doc: 0, main: 0 });

    for (const control of await page
      .locator('main select, main input:not([type=checkbox]), main textarea, main button')
      .all()) {
      if (!(await control.isVisible())) continue;
      const box = await control.boundingBox();
      expect(
        box!.height,
        await control.evaluate((el) => el.outerHTML.slice(0, 80)),
      ).toBeGreaterThanOrEqual(43.5);
    }

    await page.getByRole('button', { name: 'Review Counting in hundreds', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Where this came from')).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    const inner = await dialog.evaluate((el) => {
      const body = el.querySelector('[class*="overflow-y"]') ?? el;
      return body.scrollWidth - body.clientWidth;
    });
    expect(inner).toBeLessThanOrEqual(0);
    for (const control of await dialog.locator('select, input, button').all()) {
      if (!(await control.isVisible())) continue;
      const b = await control.boundingBox();
      expect(
        b!.height,
        await control.evaluate((el) => el.outerHTML.slice(0, 80)),
      ).toBeGreaterThanOrEqual(43.5);
      expect(
        await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(14);
    }
  });
});
