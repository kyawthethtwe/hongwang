import { defineConfig, devices } from '@playwright/test';

/**
 * Golden paths (implementation plan, M0 5.4) against a running, seeded app: locally `pnpm dev`
 * (web :3000 + API :4000) after `pnpm db:seed`; on staging, E2E_BASE_URL=https://... (5.6).
 * The tests pick free dates and undo what they create, so they can run again on the same data.
 *
 * Locally they drive the installed Google Chrome (no browser download). Set E2E_CHANNEL='' to use
 * Playwright's own Chromium after `pnpm exec playwright install chromium` (CI).
 */
const channel = process.env.E2E_CHANNEL ?? 'chrome';

export default defineConfig({
  testDir: './e2e',
  // One worker: the paths share seeded listings and accounts.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'golden-paths', testMatch: /\.spec\.ts/, dependencies: ['setup'] },
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ...(channel ? { channel } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
