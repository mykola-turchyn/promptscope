import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'pnpm --dir ../.. exec turbo run dev --filter=@promptscope/web --filter=@promptscope/ingest --filter=@promptscope/worker',
    url: `${BASE_URL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
