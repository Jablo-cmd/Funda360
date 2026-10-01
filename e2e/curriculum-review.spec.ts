import { test, expect, type Page } from '@playwright/test';
import { mockReview, VERSION_CODE } from './utils/reviewMocks';

/** The curriculum specialist review screen, against a mocked network that applies the database's refusals. */

const PATH = `/content-studio/curriculum-review/${VERSION_CODE}`;

async function open(page: Page, tab?: string) {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { name: 'Curriculum review', level: 1 })).toBeVisible();
  if (tab) await page.getByRole('button', { name: tab, exact: true }).click();
}

test('the review page shows the version as draft and not verified, with both sources only indexed', async ({ page }) => {
  await mockReview(page);
  await open(page);
  await expect(page.getByText(/Grade 4 Mathematics, Term 1 \(2026 ATP reconciliation/).first()).toBeVisible();
  await expect(page.getByRole('status', { name: 'Overall status' })).toHaveText('DRAFT — NOT VERIFIED');
  const sources = page.getByRole('list', { name: 'Source status' });
  await expect(sources.getByRole('listitem').filter({ hasText: 'CAPS Mathematics Grades 4-6' })).toContainText('Indexed: found at a location, not downloaded');
  await expect(sources.getByRole('listitem').filter({ hasText: '2026 Annual Teaching Plan' })).toContainText('Indexed: found at a location, not downloaded');
  // There is no approve button anywhere on the review page: approval is a separate step.
  await expect(page.getByRole('button', { name: /approve/i })).toHaveCount(0);
});

test('the dashboard numbers come from the database and update after a decision', async ({ page }) => {
  await mockReview(page);
  await open(page);
  const dashboard = page.getByRole('region', { name: 'Review summary' }).or(page.locator('section', { hasText: 'Review summary' }));
  await expect(dashboard.getByText('27 total · 0 verified · 27 pending')).toBeVisible();
  await expect(dashboard.getByText('17 total · 0 accepted · 17 pending')).toBeVisible();
  await expect(dashboard.getByText('112 total · 0 accepted · 112 pending')).toBeVisible();
  await expect(dashboard.getByText('60 total · 0 accepted · 60 pending')).toBeVisible();
  await expect(dashboard.getByText('9 total · 9 open · 0 resolved · 0 deferred (0 affect scope)')).toBeVisible();
  await expect(dashboard.getByText(/Pending · details recorded 0 of 1/)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Blockers' })).toBeVisible();

  await page.getByRole('button', { name: 'Lessons', exact: true }).click();
  await page.getByRole('button', { name: /^Review: Counting in steps/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Accept').check();
  await dialog.getByLabel('Reviewer notes (required)').fill('Read through as a teacher would deliver it');
  await dialog.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Accepted recorded.' })).toBeVisible();
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await expect(page.getByText('17 total · 1 accepted · 16 pending')).toBeVisible();
});

test('an objective cannot be verified against a source that is not identity-verified', async ({ page }) => {
  const { calls } = await mockReview(page);
  await open(page, 'Objectives');
  const item = page.locator('li', { hasText: 'G4.MATH.2026.T1.WN.01' }).first();
  await expect(item.getByText('27 in total').or(page.getByText(/3 in total/))).toBeVisible();
  await expect(item.getByText('1 lessons · 7 resources · 2 practice checks (4 questions)')).toBeVisible();
  await expect(item.getByText('Source reference as recorded (not verified)')).toBeVisible();
  await item.getByRole('button', { name: /^Review:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Review objective' });
  await dialog.getByLabel('Verify').check();
  await expect(dialog.getByRole('alert')).toContainText('No source has its identity verified yet');
  await dialog.getByLabel('Reviewer notes (required)').fill('I checked the ATP');
  await expect(dialog.getByRole('button', { name: 'Verify', exact: true })).toBeDisabled();
  expect(calls.decisions).toHaveLength(0);
});

test('a reviewer can request a correction with notes, which records a finding instead of editing', async ({ page }) => {
  const { calls } = await mockReview(page);
  await open(page, 'Objectives');
  const item = page.locator('li', { hasText: 'G4.MATH.2026.T1.NS.03' }).first();
  await item.getByRole('button', { name: /^Review:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Review objective' });
  await dialog.getByLabel('Request correction').check();
  const submit = dialog.getByRole('button', { name: 'Request correction', exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('What kind of problem is it?').selectOption('curriculum_mismatch');
  await dialog.getByLabel('Reviewer notes (required)').fill('The ATP bullet is narrower than this wording');
  await submit.click();
  await expect.poll(() => calls.decisions).toEqual([
    expect.objectContaining({ p_entity_type: 'objective', p_decision: 'needs_correction', p_notes: 'The ATP bullet is narrower than this wording', p_finding_category: 'curriculum_mismatch', p_source_id: null }),
  ]);
  await expect(item.getByText('Needs correction', { exact: true })).toBeVisible();
  await expect(item.getByText(/The ATP bullet is narrower than this wording/)).toBeVisible();
  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  const findings = page.getByRole('list', { name: 'Findings' });
  await expect(findings.getByText('The ATP bullet is narrower than this wording')).toBeVisible();
  await expect(findings.getByText('Open', { exact: true })).toBeVisible();
});

test('with verified sources an objective is verified only with source, section and page', async ({ page }) => {
  const { calls } = await mockReview(page, { sourcesVerified: true });
  await open(page, 'Objectives');
  const item = page.locator('li', { hasText: 'G4.MATH.2026.T1.WN.01' }).first();
  await item.getByRole('button', { name: /^Review:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Review objective' });
  await dialog.getByLabel('Verify').check();
  const submit = dialog.getByRole('button', { name: 'Verify', exact: true });
  await dialog.getByLabel('Reviewer notes (required)').fill('Checked against the Term 1 list');
  await expect(submit).toBeDisabled();
  await expect(dialog.getByLabel('Still needed')).toContainText('Choose the source');
  await dialog.getByLabel('Source checked').selectOption('atp');
  await dialog.getByLabel('Section of the source').fill('Term 1');
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('Page or reference').fill('12');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => calls.decisions).toEqual([
    expect.objectContaining({ p_decision: 'verified', p_source_id: 'atp', p_source_section: 'Term 1', p_source_page: '12' }),
  ]);
  await expect(item.getByText('Verified', { exact: true })).toBeVisible();
  await expect(item.getByText(/Source section Term 1, page 12/)).toBeVisible();
});

test('the nine open questions can be deferred with a reason but not resolved without evidence', async ({ page }) => {
  const { calls } = await mockReview(page);
  await open(page, 'Open questions');
  const list = page.getByRole('list', { name: 'Open questions' });
  await expect(list.getByRole('listitem')).toHaveCount(9);
  for (const title of ['Division / inverse operations', 'Number range', 'Operations covered by properties', 'Weeks and hours', 'Cents / decimals', 'Formal assignment details', 'Measurement units', 'CAPS URL identity and current edition', 'ATP record completeness']) {
    await expect(list.getByText(title, { exact: false }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: 'Answer or defer question Q1' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Status').selectOption('resolved');
  await expect(dialog.getByRole('alert')).toContainText('No source has its identity verified yet');
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
  await dialog.getByLabel('Status').selectOption('deferred');
  await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
  await dialog.getByLabel(/^Why is it deferred/).fill('The ATP PDF could not be read');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => calls.questions).toEqual([
    expect.objectContaining({ p_status: 'deferred', p_answer: null, p_source_id: null, p_notes: 'The ATP PDF could not be read' }),
  ]);
  await expect(list.getByText('Deferred: requires further curriculum review')).toBeVisible();
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  await expect(page.getByText('9 total · 8 open · 0 resolved · 1 deferred (1 affect scope)')).toBeVisible();
});

test('a question resolved with evidence records the answer, source, section and page', async ({ page }) => {
  const { calls } = await mockReview(page, { sourcesVerified: true });
  await open(page, 'Open questions');
  await page.getByRole('button', { name: 'Answer or defer question Q2' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Status').selectOption('resolved');
  await dialog.getByLabel('Answer', { exact: true }).fill('Counting to at least 10 000');
  await dialog.getByLabel('Source of the answer').selectOption('caps');
  await dialog.getByLabel('Section of the source').fill('3.3.1');
  await dialog.getByLabel('Page or reference').fill('35');
  await dialog.getByLabel(/^Explanation/).fill('Read the Term 1 content list');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => calls.questions).toEqual([
    expect.objectContaining({ p_status: 'resolved', p_answer: 'Counting to at least 10 000', p_source_id: 'caps', p_source_section: '3.3.1', p_source_page: '35' }),
  ]);
  await expect(page.getByRole('list', { name: 'Open questions' }).getByText('Resolved', { exact: true })).toBeVisible();
});

test('the formal assessment shows only what is known and invents no marks or weighting', async ({ page }) => {
  const { calls } = await mockReview(page, { sourcesVerified: true });
  await open(page, 'Formal assessment');
  await expect(page.getByText('Details: not recorded: pending')).toBeVisible();
  for (const label of ['Name', 'Type', 'Scope', 'Duration', 'Timing', 'Marks', 'Weighting', 'Instructions', 'Source']) {
    await expect(page.getByText('Not recorded', { exact: true }).first()).toBeVisible();
    await expect(page.locator('dt', { hasText: new RegExp(`^${label}$`) })).toBeVisible();
  }
  await expect(page.getByText('Not recorded', { exact: true })).toHaveCount(9);
  await page.getByRole('button', { name: 'Record official details of the formal assessment' }).click();
  const dialog = page.getByRole('dialog');
  const record = dialog.getByRole('button', { name: 'Record details' });
  await expect(record).toBeDisabled();
  await dialog.getByLabel('Assessment name').fill('Term 1 assignment');
  await dialog.getByLabel('Assessment type').fill('Assignment');
  await dialog.getByLabel('Scope').fill('Whole numbers, number sentences, addition and subtraction');
  await dialog.getByLabel(/^Duration in minutes/).fill('180');
  await dialog.getByRole('combobox', { name: /^Source/ }).selectOption('atp');
  await dialog.getByLabel('Section of the source').fill('Term 1');
  await dialog.getByLabel('Page or reference').fill('12');
  await dialog.getByLabel('Reviewer notes (required)').fill('Copied from the Term 1 assessment row');
  await record.click();
  await expect.poll(() => calls.formal).toEqual([
    expect.objectContaining({ p_name: 'Term 1 assignment', p_duration_minutes: 180, p_marks: null, p_weighting: null, p_source_id: 'atp', p_source_page: '12' }),
  ]);
  await expect(page.getByText('180 minutes')).toBeVisible();
  await expect(page.getByText('Details: recorded from a source')).toBeVisible();
  await expect(page.getByText('Not recorded', { exact: true })).toHaveCount(4);
});

test('lessons show their parts, resources can be flagged without editing, and findings can be closed', async ({ page }) => {
  const { calls } = await mockReview(page);
  await open(page, 'Lessons');
  const lesson = page.locator('li', { hasText: 'Counting in steps up to 10 000' }).first();
  await lesson.getByText('Teaching explanation and notes').click();
  await expect(lesson.getByText('Use bottle tops.')).toBeVisible();
  await lesson.getByText(/1 activities, 2 resources/).click();
  await expect(lesson.getByText(/Skip counting circle/)).toBeVisible();
  await expect(lesson.getByText(/practise: Practice: counting/)).toBeVisible();

  await page.getByRole('button', { name: 'Resources', exact: true }).click();
  const resource = page.locator('li', { hasText: 'Teacher explanation: counting in 50s' }).first();
  await expect(resource.getByText('No projector')).toBeVisible();
  await resource.getByText('Content, answers and teacher notes').click();
  await expect(resource.getByText('Answers for the teacher: 1) 150')).toBeVisible();
  await resource.getByRole('button', { name: /^Flag an issue:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Flag an issue' });
  await dialog.getByLabel('Kind of problem').selectOption('incorrect_answer');
  await expect(dialog.getByRole('button', { name: 'Record finding' })).toBeDisabled();
  await dialog.getByLabel('What is wrong?').fill('The answer to item 1 should be 150 then 200');
  await dialog.getByRole('button', { name: 'Record finding' }).click();
  await expect.poll(() => calls.findings).toEqual([
    expect.objectContaining({ p_entity_type: 'resource', p_category: 'incorrect_answer', p_description: 'The answer to item 1 should be 150 then 200' }),
  ]);
  await expect(resource.getByText('Pending', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Findings', exact: true }).click();
  await page.getByRole('button', { name: /^Close finding:/ }).click();
  const close = page.getByRole('dialog', { name: 'Close finding' });
  await expect(close.getByRole('button', { name: 'Close finding' })).toBeDisabled();
  await close.getByLabel(/^How was it dealt with/).fill('Corrected in the next draft');
  await close.getByRole('button', { name: 'Close finding' }).click();
  await expect.poll(() => calls.resolvedFindings).toEqual([{ p_finding_id: 'f-1', p_status: 'resolved', p_note: 'Corrected in the next draft' }]);
});

test('questions show the key to the reviewer, and a rejection needs notes', async ({ page }) => {
  const { calls } = await mockReview(page);
  await open(page, 'Questions');
  const q = page.locator('li', { hasText: 'Thandi counts in 50s' }).first();
  await expect(q.getByText('Answer (teacher only)')).toBeVisible();
  await expect(q.getByText('No. Counting in 50s the numbers end in 00 or 50.')).toBeVisible();
  await expect(q.getByText('Accept any correct explanation.')).toBeVisible();
  await expect(q.getByText(/short answer · challenge · 2 mark\(s\)/)).toBeVisible();
  await q.getByRole('button', { name: /^Review:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Review question' });
  await dialog.getByLabel('Reject').check();
  const reject = dialog.getByRole('button', { name: 'Reject', exact: true });
  await expect(reject).toBeDisabled();
  await dialog.getByLabel('Reviewer notes (required)').fill('1 025 is not obviously excluded for a Grade 4 learner');
  await reject.click();
  await expect.poll(() => calls.decisions).toEqual([expect.objectContaining({ p_entity_type: 'question', p_decision: 'rejected' })]);
  await expect(q.getByText('Rejected', { exact: true })).toBeVisible();
});

test('a teacher cannot open the review page', async ({ page }) => {
  await mockReview(page, { role: 'teacher' });
  await page.goto(PATH);
  await expect(page).not.toHaveURL(/curriculum-review/);
});

test('the content studio links to the review of versions in the workflow', async ({ page }) => {
  await mockReview(page);
  await page.goto('/content-studio');
  await page.getByRole('link', { name: /^Review Grade 4 Mathematics, Term 1/ }).click();
  await expect(page).toHaveURL(new RegExp(`curriculum-review/${VERSION_CODE}`));
});

test.describe('on a small phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });
  test('every review tab fits the screen with large touch targets, dialogs included', async ({ page }) => {
    await mockReview(page, { sourcesVerified: true });
    await open(page);
    const measure = () =>
      page.evaluate(() => {
        const main = document.querySelector('main');
        return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
      });
    for (const tab of ['Summary', 'Objectives', 'Open questions', 'Formal assessment', 'Lessons', 'Resources', 'Practice checks', 'Questions', 'Findings']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      expect(await measure(), tab).toEqual({ doc: 0, main: 0 });
      for (const control of await page.locator('main select, main input:not([type=checkbox]), main textarea, main button').all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        expect(box!.height, `${tab}: ${await control.evaluate((el) => el.outerHTML.slice(0, 90))}`).toBeGreaterThanOrEqual(43.5);
      }
    }
    await page.getByRole('button', { name: 'Objectives', exact: true }).click();
    await page.getByRole('button', { name: /^Review: G4.MATH.2026.T1.WN.01/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Verify').check();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    // Radio buttons are labelled rows of 44px; the row is the touch target.
    for (const control of await dialog.locator('select, input:not([type=radio]), textarea, button').all()) {
      if (!(await control.isVisible())) continue;
      const b = await control.boundingBox();
      expect(b!.height, await control.evaluate((el) => el.outerHTML.slice(0, 90))).toBeGreaterThanOrEqual(35);
    }
    for (const row of await dialog.locator('fieldset label').all()) {
      const b = await row.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(43.5);
    }
  });
});
