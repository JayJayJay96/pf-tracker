import { readFileSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3000';

/**
 * Loads `.env.local` into the test process.
 *
 * The dev server reads that file itself, but the Playwright runner is a separate
 * process, so without this the service-role key needed to provision test users is
 * missing. Existing environment variables win, so CI can override.
 */
function loadLocalEnv(): void {
  let contents: string;
  try {
    contents = readFileSync('.env.local', 'utf8');
  } catch {
    return;
  }
  for (const line of contents.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '');
  }
}

loadLocalEnv();

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
