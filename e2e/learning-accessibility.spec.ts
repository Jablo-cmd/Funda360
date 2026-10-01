import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockLearning } from './utils/learningMocks';
import { mockStudio } from './utils/studioMocks';

/**
 * axe-core (WCAG 2.1 A and AA) over the curriculum screens: the teacher's Learning hub, curriculum setup and
 * the Content Studio, in light and dark mode, on a phone and on a desktop. Every violation fails, whatever its
 * impact. Dialogs are scanned while open, because that is where most of the interactive content is.
 * Automated scanning is a floor, not a certification: it does not judge reading order or screen-reader phrasing.
 */

const THEMES = ['light', 'dark'] as const;
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  if (results.violations.length > 0) {
    console.log(
      label,
      JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes
            .slice(0, 3)
            .map((n) => ({ html: n.html.slice(0, 160), summary: n.failureSummary?.slice(0, 200) })),
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

      test(`Learning hub, with its dialogs, has no violations (${label})`, async ({ page }) => {
        await mockLearning(page);
        await page.goto('/learning');
        await expect(
          page.getByRole('heading', { name: 'Place value to 10 000', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('list', { name: 'Class summary' })).toBeVisible();
        await expectNoViolations(page, `/learning ${label}`);

        await page.getByRole('button', { name: 'Show (2)' }).click();
        await expectNoViolations(page, `/learning show tab ${label}`);
        await page
          .locator('li', { hasText: 'Place value chart' })
          .getByRole('button', { name: /Open/ })
          .click();
        await expect(page.getByRole('dialog', { name: 'Place value chart' })).toBeVisible();
        await expectNoViolations(page, `/learning resource dialog ${label}`);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Record results' }).click();
        await expect(page.getByRole('dialog', { name: 'Record results' })).toBeVisible();
        await expectNoViolations(page, `/learning record results ${label}`);
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Suggest next steps' }).click();
        await expect(page.getByRole('list', { name: 'Suggested next steps' })).toBeVisible();
        await expectNoViolations(page, `/learning suggestions ${label}`);
      });

      test(`Curriculum setup has no violations (${label})`, async ({ page }) => {
        await mockLearning(page, { role: 'principal' });
        await page.goto('/learning/setup');
        await expect(
          page.getByRole('heading', { name: 'Curriculum setup', level: 1 }),
        ).toBeVisible();
        await expect(page.getByText('In use')).toBeVisible();
        await expectNoViolations(page, `/learning/setup ${label}`);
      });

      test(`Content Studio and its review dialog have no violations (${label})`, async ({
        page,
      }) => {
        await mockStudio(page);
        await page.goto('/content-studio');
        await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
        await page.getByLabel('Curriculum version').selectOption('v-a');
        await page.getByLabel(/^Topic/).selectOption('t1');
        await expect(page.getByLabel(/AI\.O1/)).toBeVisible();
        await expectNoViolations(page, `/content-studio ${label}`);

        await page
          .getByRole('button', { name: 'Review Counting in hundreds', exact: true })
          .click();
        const dialog = page.getByRole('dialog', { name: /Lesson: Counting in hundreds/ });
        await expect(dialog.getByText('Where this came from')).toBeVisible();
        await expectNoViolations(page, `/content-studio review dialog ${label}`);

        await dialog.getByRole('button', { name: 'Run checks' }).click();
        await expect(dialog.getByRole('list', { name: 'Findings' })).toBeVisible();
        await dialog.getByLabel(/^Source/).selectOption('src-1');
        await expectNoViolations(page, `/content-studio findings ${label}`);
      });
    });
  }
}
