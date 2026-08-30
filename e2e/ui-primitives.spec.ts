import { test, expect } from '@playwright/test';
import { seedAuthenticatedSession } from './utils/mockAuth';
import { buildMockSchoolRow, buildMockProfileRow, installDataMocks } from './utils/mockData';

test('the account dropdown opens, closes on Escape, and closes on an outside click', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Ada Principal/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toHaveCount(0);

  await page.getByRole('button', { name: /Ada Principal/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toHaveCount(0);
});
