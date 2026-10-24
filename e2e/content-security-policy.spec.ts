import { test, expect, type Page } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockProfileRow, buildMockSchoolRow, installDataMocks } from './utils/mockData';

// The suite runs against the production build, so the Content-Security-Policy
// meta tag (vite.config.ts) is active here exactly as on GitHub Pages.

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

test('the built app carries a Content-Security-Policy that refuses unknown scripts', async ({ page }) => {
  await page.goto('/login');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/);
  expect(policy).not.toContain('unsafe-eval');
  expect(policy).toContain("object-src 'none'");
});

test('the theme bootstrap script still runs under the policy', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('funda360-theme', 'dark'));
  await page.goto('/login');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('an injected inline script is blocked', async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.goto('/login');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__injected = true';
    document.body.appendChild(script);
  });
  expect(await page.evaluate(() => (window as unknown as { __injected?: boolean }).__injected)).toBeUndefined();
  expect(violations.length).toBeGreaterThan(0);
});

test('a signed-in dashboard loads with no policy violations', async ({ page }) => {
  const violations = collectCspViolations(page);
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'principal' }), school: buildMockSchoolRow() });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  expect(violations).toEqual([]);
});
