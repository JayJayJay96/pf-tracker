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
  /*
   * Well above the 5s default, because the app under test is a dev server that
   * compiles a route the first time it is asked for one. With several workers
   * requesting different routes at once those compiles queue, and the first
   * assertion in each spec file - always the one waiting on a freshly compiled
   * page - lost the race. That failed seven specs under parallel workers while
   * every one of them passed when run alone, which reads as a broken app rather
   * than a slow one.
   */
  expect: { timeout: 20_000 },
  /*
   * The per-test budget has to clear the assertion timeout above, or a slow first
   * navigation ends the test before the assertion it is waiting on can fail on its
   * own terms. At the 30s default, `page.goto` was consuming the whole budget by
   * itself while routes compiled.
   */
  timeout: 60_000,
  /*
   * One worker. These specs drive a dev server that compiles a route the first
   * time it is requested, and it does not hold up under concurrent load: with the
   * default worker count a single `page.goto` took over 90 seconds and specs
   * failed in groups, every one of which passed when run on its own. Serially the
   * whole suite passes in less wall-clock time than the parallel run took to fail,
   * so there is nothing to trade off here.
   */
  workers: 1,
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
