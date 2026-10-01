import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockReview, VERSION_CODE } from './utils/reviewMocks';
import { mockStudio } from './utils/studioMocks';

/**
 * axe-core (WCAG 2.1 A and AA) over the curriculum review screen and the sources panel with its new forms, in light
 * and dark mode, on a phone and on a desktop, every tab and every dialog. Every violation fails, whatever its impact.
 */

const THEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  if (results.violations.length > 0) {
    console.log(
      label,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 3).map((n) => ({ html: n.html.slice(0, 160), summary: n.failureSummary?.slice(0, 200) })),
        })),
        null,
        2,
      ),
    );
  }
  expect(results.violations, `${label}: ${results.violations.length} violation(s)`).toEqual([]);
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const label = `${theme} / ${viewport.name}`;
    test.describe(label, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((t) => window.localStorage.setItem('funda360-theme', t), theme);
      });

      test(`every review tab and dialog has no violations (${label})`, async ({ page }) => {
        await mockReview(page, { sourcesVerified: true });
        await page.goto(`/content-studio/curriculum-review/${VERSION_CODE}`);
        await expect(page.getByRole('status', { name: 'Overall status' })).toBeVisible();
        await page.getByText('What each step means').click();
        await expectNoViolations(page, `summary ${label}`);

        for (const tab of ['Objectives', 'Open questions', 'Formal assessment', 'Lessons', 'Resources', 'Practice checks', 'Questions']) {
          await page.getByRole('button', { name: tab, exact: true }).click();
          await expect(page.getByRole('heading', { name: tab === 'Open questions' ? 'Open questions' : tab === 'Formal assessment' ? 'Formal assessment' : tab, level: 2 })).toBeVisible();
          await expectNoViolations(page, `${tab} ${label}`);
        }

        await page.getByRole('button', { name: 'Objectives', exact: true }).click();
        await page.getByRole('button', { name: /^Review: G4.MATH.2026.T1.WN.01/ }).click();
        let dialog = page.getByRole('dialog', { name: 'Review objective' });
        await dialog.getByLabel('Verify').check();
        await expectNoViolations(page, `objective dialog (verify) ${label}`);
        await dialog.getByLabel('Request correction').check();
        await expectNoViolations(page, `objective dialog (correction) ${label}`);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Open questions', exact: true }).click();
        await page.getByRole('button', { name: 'Answer or defer question Q1' }).click();
        dialog = page.getByRole('dialog');
        await dialog.getByLabel('Status').selectOption('resolved');
        await expectNoViolations(page, `question dialog (resolve) ${label}`);
        await dialog.getByLabel('Status').selectOption('deferred');
        await expectNoViolations(page, `question dialog (defer) ${label}`);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Formal assessment', exact: true }).click();
        await page.getByRole('button', { name: 'Record official details of the formal assessment' }).click();
        await expectNoViolations(page, `formal assessment dialog ${label}`);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Resources', exact: true }).click();
        await page.getByRole('button', { name: /^Flag an issue:/ }).first().click();
        await expectNoViolations(page, `flag dialog ${label}`);
        await page.getByLabel('What is wrong?').fill('A problem found while reading');
        await page.getByRole('button', { name: 'Record finding' }).click();
        await page.getByRole('button', { name: 'Findings', exact: true }).click();
        await expectNoViolations(page, `findings ${label}`);
        await page.getByRole('button', { name: /^Close finding:/ }).click();
        await expectNoViolations(page, `close finding dialog ${label}`);
      });

      test(`the sources panel with its review forms has no violations (${label})`, async ({ page }) => {
        await mockStudio(page);
        await page.goto('/content-studio');
        await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
        await page.getByText('What each step means').first().click();
        await page.locator('summary', { hasText: 'What is recorded' }).first().click();
        await expectNoViolations(page, `sources ${label}`);
      });
    });
  }
}
