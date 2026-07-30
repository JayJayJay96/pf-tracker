import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    // A git worktree is a separate checkout that lints itself, so its files are
    // not this project's to report on. The entry above only matches build output
    // at the top level, which left the copy nested inside a worktree to be linted
    // - over a thousand errors, all of them in minified bundles.
    '.worktrees/**',
    'coverage/**',
    'playwright-report/**',
    'supabase/.temp/**',
    'test-results/**',
  ]),
]);
