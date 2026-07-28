# Task 1.2 Report — Profiles, Categories, and Row-Level Security

## Scope delivered

- Added `public.profiles` with UUID primary key, an `auth.users(id)` owner
  foreign key, timestamps, a `user_id` index, and current preference fields.
- Added `public.categories` with UUID primary key, an `auth.users(id)` owner
  foreign key, timestamps, a `user_id` index, name, category type, nonnegative
  sort order, and active status.
- Added database checks for:
  - Currency: `RM`.
  - Period type: `calendar_month` or `salary_cycle`.
  - Default payment method: `tng` or `cash`.
  - Category type: `expense`, `commitment`, `savings`, `investment`, or
    `income`.
  - Category sort order at or above zero.
  - Nonblank category names.
- Enabled RLS on both tables and added separate authenticated select, insert,
  update, and delete policies. Every policy compares
  `(select auth.uid()) = user_id`; insert and update include `WITH CHECK`.
- Granted only table CRUD access needed by the authenticated role.
- Added `public.handle_new_user()` and an `auth.users` after-insert trigger.
  The function is `security definer`, uses `set search_path = ''`, fully
  qualifies `public.profiles`, and is not directly executable by `public`.
- Kept the migration limited to profiles and categories; no financial plan or
  transaction schema was introduced.

## TDD evidence

The pgTAP test was created before the production migration.

Initial command:

```text
npm run test:db
```

Initial result: **FAIL**, as expected. The first four assertions reported that
the profiles table, categories table, and their owner indexes did not exist.
Execution then stopped on `relation "public.profiles" does not exist`. The
existing smoke test continued to pass. This established that the new test
detected the missing production behavior.

After the migration was added, the first test execution exposed a PostgreSQL
test-query limitation: a data-modifying CTE had been nested inside a scalar
subquery. The test was corrected to pass top-level `UPDATE ... RETURNING` and
`DELETE ... RETURNING` queries to `results_eq`, preserving the intended
assertion that cross-user operations return zero rows. No production behavior
was changed for this test-harness correction.

Final database command:

```text
npm run test:db
```

Final result: **PASS**.

```text
Files=2, Tests=36
profiles_rls.test.sql .. ok
smoke.test.sql ......... ok
All tests successful.
```

The 35 new pgTAP assertions cover:

- Both tables and both owner indexes.
- Trigger-created profiles for two isolated auth users.
- Exact profile defaults: `RM`, `Asia/Kuala_Lumpur`, `calendar_month`, and
  `tng`.
- Own profile read, insert, update, and delete.
- Own category read, insert, update, and delete.
- Cross-user profile and category reads returning no rows.
- Cross-user profile and category updates/deletes returning no rows.
- Inserts and updates that assign another user's `user_id` being rejected by
  RLS.
- Invalid currency, period type, payment method, category type, negative sort
  order, and blank category name being rejected.
- RLS enabled on both tables.
- Four authenticated CRUD policies on each table.
- The trigger function's constrained search path.

## Database reset evidence

Command:

```text
npx supabase db reset
```

Result: **PASS**. The local database was recreated, migration
`20260728000000_profiles_and_categories.sql` was applied, the intentionally
empty local seed ran, and containers restarted successfully.

## Regression verification

All requested application checks passed:

```text
npm run test:unit  — PASS, 7 files / 41 tests
npm run lint       — PASS
npm run typecheck  — PASS
npm run build      — PASS, optimized production build completed
```

`git diff --check` also completed without whitespace errors.

## Files

- `supabase/migrations/20260728000000_profiles_and_categories.sql`
- `supabase/tests/profiles_rls.test.sql`
- `.superpowers/sdd/2026-07-28-personal-finance-tracker-mvp/task-1.2-report.md`
