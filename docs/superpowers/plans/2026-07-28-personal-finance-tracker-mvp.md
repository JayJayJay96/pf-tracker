# Personal Finance Tracker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a private, mobile-first PWA that gives the owner a conservative monthly spendable amount and correctly manages personal expenses, shared bills, and friend repayments.

**Architecture:** A Next.js App Router application uses Supabase Auth and PostgreSQL as its system of record. Pure TypeScript domain modules calculate money and state transitions; Supabase migrations enforce ownership and integrity. The first release is online-first with locally persisted drafts; offline-created record synchronization is a later release.

**Tech Stack:** Next.js, TypeScript, Supabase (`@supabase/supabase-js`, `@supabase/ssr`, PostgreSQL), Vercel, Zod, Vitest, pgTAP, Playwright.

## Global Constraints

- Currency is RM only; store money as integer sen, never floating-point values.
- Financial periods are calendar months; transaction date controls reporting and recorded date preserves audit history.
- Remaining spendable = confirmed income − all active commitments − savings − investments − resolved personal spending.
- Shared bill cash outflow is its full paid amount; only the user's resolved portion is personal spending.
- Unresolved shared bills remain excluded from personal spending and visibly flagged.
- Friend repayments settle receivables; they are never income. Partial repayments are out of scope.
- A payment request snapshots and locks its included friend portions until cancellation, payment, or forgiveness.
- Every user-owned table has `user_id`, RLS, an index on `user_id`, and ownership policies.
- Never place a Supabase service-role key in browser code. Use `auth.getClaims()` for server authorization, not `getSession()`.
- Use migrations only for remote schema changes. Do not manually alter the production database.
- Build PWA installation and local draft persistence in MVP; defer offline write queues, conflict handling, and background sync.

---

## Phase 0: Project Bootstrap, Documentation, and Delivery Guardrails

**Outcome:** A reproducible local development environment, empty authenticated app shell, test runners, and deployment-safe configuration.

**Documentation references:** [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables), [Supabase Next.js SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs), [Supabase local CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [Vitest](https://vitest.dev/guide/), [Playwright configuration](https://playwright.dev/docs/test-configuration).

### Task 0.1: Initialize the repository and application

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`
- Create: `.env.example`, `.gitignore`, `README.md`

- [ ] Create a Git repository, scaffold a current Next.js TypeScript App Router application, and retain the generated TypeScript strict configuration.
- [ ] Add `.env.example` containing only `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, and `SUPABASE_SERVICE_ROLE_KEY=`; ensure `.env.local` is ignored.
- [ ] Install `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `vitest`, `@vitest/coverage-v8`, `@playwright/test`, and the Supabase CLI as a development dependency.
- [ ] Add scripts: `lint`, `typecheck`, `test:unit` (`vitest run`), `test:coverage` (`vitest run --coverage`), `test:e2e` (`playwright test`), and `test:db` (`supabase test db`).
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:unit`, and `npm run build`; commit `chore: bootstrap finance tracker`.

### Task 0.2: Configure local Supabase and test layers

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql`
- Create: `vitest.config.ts`, `playwright.config.ts`, `src/domain/README.md`

- [ ] Run `npx supabase init` and `npx supabase start`; record required local environment values in `.env.local` only.
- [ ] Configure Vitest with `environment: 'node'` and `include: ['src/**/*.test.ts']` so money calculations remain independent of browser APIs.
- [ ] Configure Playwright with Chromium, `testDir: './tests/e2e'`, base URL `http://127.0.0.1:3000`, trace on first retry, and a `webServer` running `npm run dev`.
- [ ] Add a passing `src/domain/smoke.test.ts`, a pgTAP smoke test under `supabase/tests`, and a Playwright home-page smoke test.
- [ ] Verify `npx supabase test db`, `npm run test:unit`, and `npm run test:e2e`; commit `test: add local finance tracker test harness`.

**Guards:** Never seed real finance data. Do not run a linked database reset against a real Supabase project.

---

## Phase 1: Authentication, User Isolation, and App Shell

**Outcome:** The owner can request a passwordless link, return to an authenticated app, and access only their own data.

**Documentation references:** [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication).

### Task 1.1: Implement Supabase SSR helpers and magic-link flow

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`
- Create: `proxy.ts`, `app/auth/sign-in/page.tsx`, `app/auth/confirm/route.ts`, `app/(app)/layout.tsx`

- [ ] Create browser and cookie-backed server clients using `createBrowserClient` and `createServerClient` from `@supabase/ssr`.
- [ ] Add `proxy.ts` that refreshes sessions with the official `updateSession(request)` pattern and excludes static assets via its matcher.
- [ ] Implement a sign-in form that calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin + '/auth/confirm', shouldCreateUser: true } })`.
- [ ] Configure the Supabase email template to use the documented token-hash URL. In `app/auth/confirm/route.ts`, validate `token_hash` and `type`, call `verifyOtp({ token_hash, type })`, and redirect only to a sanitized relative `next` path.
- [ ] Protect `(app)` routes with `auth.getClaims()`; add sign-out; verify unauthenticated requests redirect to sign-in.

### Task 1.2: Create profile/settings ownership baseline and RLS tests

**Files:**
- Create: `supabase/migrations/<timestamp>_profiles_and_categories.sql`
- Create: `supabase/tests/profiles_rls.test.sql`
- Create: `src/lib/auth/require-user.ts`

- [ ] Add `profiles` and `categories` tables with UUID primary keys, `user_id uuid not null references auth.users(id)`, timestamps, validation checks, and `user_id` indexes.
- [ ] Enable RLS and add select/insert/update/delete policies using `(select auth.uid()) = user_id`, including `WITH CHECK` on insert and update.
- [ ] Use pgTAP to prove User A cannot read, insert for, update, or delete User B's rows.
- [ ] Run migration reset and all database tests; commit `feat: add passwordless auth and user isolation`.

**Guards:** Do not authorize server actions with `getSession()`. Do not accept an arbitrary `user_id` from a form.

---

## Phase 2: Financial Domain, Period Snapshots, and Monthly Plan

**Outcome:** The owner can define income and planned allocations; each calendar month gets historical snapshots that do not change when templates change.

### Task 2.1: Establish financial types and money/period test suite

**Files:**
- Create: `src/domain/money.ts`, `src/domain/periods.ts`, `src/domain/summary.ts`
- Create: `src/domain/money.test.ts`, `src/domain/periods.test.ts`, `src/domain/summary.test.ts`

- [ ] Define `Sen = number` and functions to parse a RM string to sen, format sen to RM, reject negative values where forbidden, and add/subtract integer sen.
- [ ] Define `getCalendarMonth(date)`, `isDateInPeriod(date, period)`, and a monthly summary function with inputs for confirmed income, commitments, savings, investments, and personal spending.
- [ ] Write cases for RM0.01, large values, a February period, a backdated transaction, pending income exclusion, and commitments deducted before payment.
- [ ] Run unit tests; commit `feat: add tested money and calendar-period domain rules`.

### Task 2.2: Add templates, generated entries, and Monthly Plan UI

**Files:**
- Create: `supabase/migrations/<timestamp>_financial_plan.sql`, `supabase/tests/financial_plan_rls.test.sql`
- Create: `src/features/plan/`, `app/(app)/plan/page.tsx`, `app/(app)/plan/actions.ts`

- [ ] Add income templates/entries and plan templates/entries for commitment, savings, and investment. Store amount in sen, recurrence, effective start/end dates, expected/due day, active status, and entry status.
- [ ] Implement an idempotent server command that creates current-month entries from active templates using a unique `(template_id, period_start)` constraint.
- [ ] Build create/edit/archive controls for templates and a month view of generated entries. Editing a template must affect only future generated entries.
- [ ] Test duplicate generation prevention, current-vs-future effective dates, historical snapshot stability, and user isolation.
- [ ] Run db, unit, type, and browser tests; commit `feat: add monthly financial plan and period snapshots`.

---

## Phase 3: Dashboard and Personal Transactions

**Outcome:** The app shows a trusted monthly spendable number and records personal expenses quickly.

### Task 3.1: Implement transaction storage and personal-expense commands

**Files:**
- Create: `supabase/migrations/<timestamp>_transactions.sql`, `supabase/tests/transactions_rls.test.sql`
- Create: `src/features/transactions/schema.ts`, `src/features/transactions/actions.ts`
- Create: `app/(app)/add/personal-expense/page.tsx`, `app/(app)/transactions/page.tsx`

- [ ] Add `transactions` with total paid sen, transaction/recorded dates, payment method (`tng` or `cash`), category, description, merchant, notes, personal/shared marker, and resolution state.
- [ ] Validate personal-expense input with Zod, derive `user_id` from authenticated claims, and write recorded date server-side.
- [ ] Build the minimum-field personal expense form and a transactions list with date, category, payment method, shared/resolved, and text filters.
- [ ] Add tests for a backdated expense appearing in its transaction month and recorded date remaining distinct.

### Task 3.2: Build the selected-month dashboard summary

**Files:**
- Create: `src/features/dashboard/queries.ts`, `src/features/dashboard/summary-view.tsx`
- Modify: `app/(app)/page.tsx`
- Test: `src/features/dashboard/queries.test.ts`

- [ ] Query only the selected calendar-month entries and calculate confirmed income, planned commitments/savings/investments, personal spending, and remaining spendable using the Phase 2 domain function.
- [ ] Display total cash outflow separately from personal spending and include a period selector.
- [ ] Show upcoming commitments, unresolved transaction count, and empty-state guidance.
- [ ] Verify a dashboard month never includes an entry solely because of its recorded date; commit `feat: add dashboard and personal expense tracking`.

---

## Phase 4: Shared-Bill Allocation and Resolution

**Outcome:** A shared bill can be saved quickly, resolved later, and allocated exactly across people.

### Task 4.1: Create bill schema and allocation engine

**Files:**
- Create: `supabase/migrations/<timestamp>_shared_bills.sql`, `supabase/tests/shared_bills_constraints.test.sql`
- Create: `src/domain/bills/allocation.ts`, `src/domain/bills/types.ts`, `src/domain/bills/allocation.test.ts`

- [ ] Add bill items, bill participants, item assignments, and bill adjustments linked to a shared transaction. Require a direct `user_id` on user-owned child rows where practical and apply RLS to every child table.
- [ ] Implement allocation in this exact order: item subtotals; item discounts; bill discounts; service charge; tax; rounding.
- [ ] Support equal item splitting, proportional/equal/selected/manual adjustment distributions, and default residual-sen assignment to the user.
- [ ] Return a typed validation error unless participant final portions equal the transaction total exactly.
- [ ] Unit-test one-person bills, three-way thirds, item-specific discount, personal voucher, proportional tax/service charge, RM0.01 residual, and invalid total mismatch.

### Task 4.2: Build unresolved and resolved shared-bill flows

**Files:**
- Create: `src/features/bills/`, `app/(app)/add/shared-expense/page.tsx`, `app/(app)/transactions/[id]/page.tsx`
- Modify: `src/features/dashboard/queries.ts`
- Test: `tests/e2e/shared-bill.spec.ts`

- [ ] Implement the quick unresolved form with total, description, date, and payment method; it must increase cash outflow but not personal spending.
- [ ] Implement the resolution editor for people, items, assignments, adjustments, calculated review, and save confirmation.
- [ ] Render the unresolved dashboard warning and disable final personal-spending treatment until successful resolution.
- [ ] Make an unresolved-to-resolved E2E scenario assert full cash outflow first, then exact user/friend portions after resolution.
- [ ] Commit `feat: add unresolved and allocated shared bills`.

**Guards:** Do not calculate bills with floats. Never silently accept a participant-total mismatch.

---

## Phase 5: Friends, Requests, and Settlements

**Outcome:** The owner sees exactly what each friend owes, requests an immutable lump sum, and marks it fully settled.

### Task 5.1: Add friend ledger and payment-request state machine

**Files:**
- Create: `supabase/migrations/<timestamp>_friends_and_requests.sql`, `supabase/tests/payment_requests.test.sql`
- Create: `src/domain/requests/state.ts`, `src/domain/requests/state.test.ts`
- Create: `src/features/friends/actions.ts`, `src/features/friends/queries.ts`

- [ ] Add friends, payment requests, and payment-request items. Snapshot description, transaction date, and amount in each request item.
- [ ] Enforce one active request per bill participant, full-payment-only transitions, and locking of requested portions. Cancellation restores the portion to unrequested; forgiveness removes it from outstanding.
- [ ] Define and test the allowed transitions: unrequested → requested → paid; requested → cancelled; requested → forgiven. Reject a second active request and a mismatched paid amount.
- [ ] Query friend totals as unrequested, requested pending, paid, forgiven, and outstanding without counting repayments as income.

### Task 5.2: Build friends and settlement screens

**Files:**
- Create: `app/(app)/friends/page.tsx`, `app/(app)/friends/[friendId]/page.tsx`, `app/(app)/friends/[friendId]/requests/[requestId]/page.tsx`
- Create: `src/features/friends/payment-summary.ts`, `tests/e2e/payment-request.spec.ts`

- [ ] Create friend profile and ledger pages with outstanding amount, selected unrequested portions, and request history.
- [ ] Create a single-friend lump-sum request, persist its snapshots, and produce a copyable dated line-item summary plus total.
- [ ] Add mark-paid, cancel, and forgive commands with confirmation UI; mark-paid stores paid date and makes all included portions settled.
- [ ] Verify E2E: create two bills, request both, add a later bill, then confirm the original request total remains unchanged and paid does not add income.
- [ ] Commit `feat: add friend balances and payment requests`.

---

## Phase 6: Historical Review, Reports, Export, and PWA Installation

**Outcome:** The owner can review accurate history, export it, and install the app safely.

**Documentation references:** [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [Next manifest convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest), [Vercel environment variables](https://vercel.com/docs/environment-variables).

### Task 6.1: Add reports and export

**Files:**
- Create: `app/(app)/reports/page.tsx`, `src/features/reports/queries.ts`, `src/features/reports/csv.ts`
- Create: `app/api/export/transactions/route.ts`, `app/api/export/friends/route.ts`, `app/api/export/requests/route.ts`, `app/api/export/backup/route.ts`
- Test: `src/features/reports/queries.test.ts`, `tests/e2e/reports.spec.ts`

- [ ] Support month, custom date range, year-to-date, and specific-year summaries using transaction date.
- [ ] Render income, commitments, savings, investments, personal spending, total paid, paid for friends, requested, collected, and outstanding; add current-vs-previous-month comparison.
- [ ] Generate CSV for transactions, friend balances, and payment requests, plus JSON full backup. Each route must verify claims and ownership before returning data.
- [ ] Test exports contain only the authenticated user's records and historical reports include backdated entries.

### Task 6.2: Add installability and safe draft persistence

**Files:**
- Create: `app/manifest.ts`, `public/icon-192x192.png`, `public/icon-512x512.png`
- Create: `src/lib/drafts.ts`, `src/features/forms/use-draft.ts`
- Modify: `next.config.ts`, shared expense and personal expense forms

- [ ] Implement the Next `MetadataRoute.Manifest` with `display: 'standalone'`, start URL, colours, and 192/512 icons.
- [ ] Persist unsaved form drafts locally with a versioned key per authenticated user and form; clear the draft after a confirmed successful save.
- [ ] Do not cache authenticated pages, API data, or finance exports in a service worker. Do not implement a custom install prompt dependent on `beforeinstallprompt`.
- [ ] Test manifest availability, draft restoration, draft isolation by user, and clearing after save; commit `feat: add reports exports and installable PWA shell`.

---

## Phase 7: Security, Accessibility, CI, and Production Release

**Outcome:** The app is verified in preview, has production safeguards, and can be released with confidence.

### Task 7.1: Harden and automate checks

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/operations/supabase-and-vercel.md`, `docs/operations/release-checklist.md`
- Modify: `next.config.ts`, `README.md`

- [ ] Add baseline security headers, never relax CSP for inline secrets, and configure a specific non-cacheable header only if a later `public/sw.js` is introduced.
- [ ] Add CI steps for install, lint, typecheck, unit tests, Supabase local start and pgTAP tests, build, and Playwright Chromium tests.
- [ ] Configure Supabase production Auth Site URL and allowlisted redirect URLs for production and Vercel previews. Configure Vercel Development, Preview, and Production variables separately; previews must never target real personal data.
- [ ] Write restore/export and rollback procedures, including how to create a backup before a migration.

### Task 7.2: Perform release verification

- [ ] Use a Vercel Preview deployment to manually verify passwordless login, setup, a personal expense, unresolved/resolved bill, payment request/paid flow, historical month, export, and mobile installation.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:coverage`, `npx supabase test db`, `npm run test:e2e`, and `npm run build`; record results in the release checklist.
- [ ] Inspect RLS policies and confirm no `SUPABASE_SERVICE_ROLE_KEY` is exposed in built browser assets.
- [ ] Promote only the reviewed preview to production; commit `chore: prepare production release`.

---

## Later Release: Full Offline Record Sync

This is intentionally not part of the core MVP. Only begin after Phase 7 is stable.

- [ ] Design an IndexedDB command queue with operation IDs, user ownership, idempotency keys, retry state, and a visible sync status.
- [ ] Add server-side idempotency handling before enabling queued writes.
- [ ] Define deterministic conflict rules for edits/deletes and test device-offline, reconnect, duplicate submit, and two-device cases.
- [ ] Evaluate Serwist only after the queue is proven; do not cache authenticated financial responses indiscriminately.

## Final Verification Checklist

- [ ] Every requirement in `personal_finance_pwa_project_v0.2.md` that is in MVP scope maps to one of Phases 1–7.
- [ ] Money calculations use integer sen and all allocation totals reconcile exactly.
- [ ] RLS tests cover every user-owned table and key dependent-table path.
- [ ] Shared bills, payment requests, and historical snapshots preserve their required immutability rules.
- [ ] No prohibited MVP features—partial repayments, bank integration, AI/OCR, or friend collaboration—have been introduced.
- [ ] Preview and production environment variables are isolated; no secrets are committed.
