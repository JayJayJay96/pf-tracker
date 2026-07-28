# Supabase and Vercel Operations

## Environment separation

Maintain independent Supabase projects for Development/CI, Vercel Preview,
and Production. A preview must never point at the production project or real
personal-finance data.

Set these Vercel variables separately for Development, Preview, and
Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The browser needs only the publishable key. Do not configure a service-role key
for this application unless a future server-only operation explicitly needs
one. Never use a `NEXT_PUBLIC_` prefix for a secret.

## Supabase Auth URLs

For Production, set the Auth Site URL to the canonical HTTPS application URL
and allow exactly:

```text
https://<production-host>/auth/confirm
```

For Vercel previews, add only the preview callback hosts that are actively in
use:

```text
https://<preview-host>/auth/confirm
```

Remove expired preview URLs. Keep the local callbacks from
`supabase/config.toml` for local development only. After changing an allowlist,
test both a valid magic link and a deliberately off-origin `next` value.

## Migration procedure

1. Confirm the target Supabase project and active Vercel environment.
2. Export a backup before applying a migration:

   ```bash
   mkdir -p backups
   npx supabase db dump --linked --file backups/pre-migration-YYYYMMDD-HHMM.sql
   ```

3. Store the dump in encrypted, access-controlled storage outside the
   repository. The `backups/` directory is ignored by Git.
4. Run local database tests against a clean reset:

   ```bash
   npx supabase db reset
   npx supabase test db
   ```

5. Apply reviewed migrations with `npx supabase db push --linked`.
6. Re-run smoke checks and verify reports, one export, and authentication.

Never edit the production schema manually. Migrations are append-only once
applied remotely.

## Backup and restore

The in-app JSON backup is an owner-scoped data export for recovery inspection;
it is not a database schema backup. Before migrations, take the database dump
above.

Test a restore in a disposable Supabase project first:

```bash
psql "$DISPOSABLE_DATABASE_URL" --set ON_ERROR_STOP=on \
  --file backups/pre-migration-YYYYMMDD-HHMM.sql
```

Confirm row counts, RLS policies, authentication, and report totals before any
production restore. A production restore is a maintenance operation: stop
writes, take one final dump, restore through the Supabase-supported database
connection, verify, then resume traffic.

## Rollback

Prefer a forward corrective migration. If a release application change is
faulty but the schema remains compatible, use Vercel rollback to promote the
last reviewed deployment.

If a migration is destructive or incompatible:

1. Stop writes and preserve a fresh dump of the current state.
2. Roll the application back only if the older version is schema-compatible.
3. Apply a reviewed forward migration that restores compatibility.
4. Restore the pre-migration database dump only when forward repair cannot
   preserve correctness, after testing the restore in a disposable project.
5. Re-run the release checklist before reopening access.
