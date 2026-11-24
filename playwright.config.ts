import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: process.env.VISUALIZER_BASE ? '**/visualizer.spec.ts' : '**/customer-flows.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: process.env.QA_OUTPUT ? `${process.env.QA_OUTPUT}/recordings` : 'test-results',
  reporter: [['list'], ['html', { outputFolder: process.env.QA_OUTPUT ? `${process.env.QA_OUTPUT}/report` : 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.VISUALIZER_BASE || process.env.CHECK_BASE || 'http://localhost:3002',
    headless: true,
    actionTimeout: 15_000,
    viewport: { width: 1440, height: 900 },
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    screenshot: 'only-on-failure',
    // Traces can capture credentials and session cookies; keep recordings visual.
    trace: 'off',
    launchOptions: { slowMo: 70 },
  },
});
