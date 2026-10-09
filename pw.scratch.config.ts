import base from '/home/user/Funda360/playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  testDir: '/home/user/Funda360/e2e',
  projects: [{ name: 'chromium', use: { ...(base.projects![0].use), launchOptions: { executablePath: '/opt/pw-browsers/chromium' } } }],
});
