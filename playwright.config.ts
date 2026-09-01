import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './tests',
  // The assessment mandates the filename `test_assignment-workflow_spec.ts`,
  // which does NOT match Playwright's default `*.spec.ts` / `*.test.ts`
  // patterns (underscore, not dot). Without this, zero tests are discovered.
  testMatch: '**/*_spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared demo account — avoid state collisions
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'https://everwrite.app.newsela.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
