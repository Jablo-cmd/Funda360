import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // A residual, separately-diagnosed flake remains even against a
  // prebuilt server: My Profile's request-heavy waterfall (employee +
  // linked learners + teaching assignments + their supporting class/
  // subject data — several concurrent REST calls per test) can
  // occasionally lose a race against `vite preview`'s single Node
  // process when several parallel workers hit it at once — confirmed by
  // running the same spec serially (0 flakes) vs. fully parallel (an
  // occasional one). This is the same known, already-documented
  // local-server connection-handling quirk in
  // docs/FUNDA360_KNOWN_LIMITATIONS.md, not expected against the pilot's
  // real hosted deployment — a small CI-only assertion-timeout increase
  // (not a blanket one) is the proportionate response to a diagnosed,
  // bounded, occasional connection-scheduling delay, not a mask for an
  // unexplained failure.
  expect: {
    timeout: process.env.CI ? 8_000 : 5_000,
  },
  webServer: {
    // CI runs against a production build served by `vite preview`, not the
    // dev server: the dev server compiles each route's module graph
    // on-demand on first request, and under fullyParallel workers the
    // first few navigations can occasionally lose that race against the
    // default 5s assertion timeout — a real, previously-observed source of
    // flaky failures with no product defect behind them, not something a
    // longer timeout should paper over. A prebuilt bundle has no
    // on-demand compilation step, so every navigation resolves at the
    // same (fast) speed regardless of parallelism. Local runs keep the
    // dev server for its faster edit-test iteration loop, where an
    // occasional cold-start retry is an acceptable trade a CI merge gate
    // should not have to make.
    command: process.env.CI ? 'npm run build && npm run preview -- --port 5173 --strictPort' : 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 120_000 : 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
