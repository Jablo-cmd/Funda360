// Captures real Funda360 screens for the promo video. The app runs from a
// local production build with every Supabase call answered by mocks
// (synthetic data only); nothing reaches a real backend.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.capture\.ts/,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1.2, // 1920 x 1080 pixels
    colorScheme: 'light',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npm run preview -- --port 5173 --strictPort',
    cwd: '../..',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
