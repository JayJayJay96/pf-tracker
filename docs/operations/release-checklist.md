# Release Checklist

Record the date, commit SHA, Vercel Preview URL, Supabase project reference,
reviewer, and result for every item.

## Automated checks

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run test:coverage`
- [ ] `npx supabase test db`
- [ ] `npm run build`
- [ ] `npm run test:e2e`

## Security and environment

- [ ] Preview uses its own non-production Supabase project and synthetic data.
- [ ] Production and preview Auth Site URL/callback allowlists are correct.
- [ ] Built browser assets contain no `SUPABASE_SERVICE_ROLE_KEY` or secret.
- [ ] RLS is enabled and owner policies exist on every user-owned table.
- [ ] Authenticated pages and all `/api/export/*` responses are non-cacheable.
- [ ] No service worker caches authenticated pages, API data, or exports.
- [ ] A pre-migration database dump exists in encrypted storage and a restore
      has been tested in a disposable project.

## Preview walkthrough

- [ ] Passwordless sign-in and sign-out.
- [ ] Monthly plan generation and dashboard.
- [ ] Personal expense, including a backdated transaction.
- [ ] Unresolved shared bill and reviewed resolution.
- [ ] Friend payment request, immutable snapshot, and full paid transition.
- [ ] Paid settlement changes collected/outstanding values but not income.
- [ ] Month, custom range, year-to-date, and specific-year reports.
- [ ] Previous-month comparison and transaction recorded-date drill-down.
- [ ] Transaction, friend, and request CSV exports contain only the owner.
- [ ] JSON backup downloads and parses.
- [ ] Draft restores after navigation/reload, is isolated per user/form, and
      clears after a successful save.
- [ ] Manifest and both icons load; mobile installation succeeds.

## Promotion and rollback

- [ ] Promote the reviewed Preview deployment; do not rebuild an unreviewed SHA.
- [ ] Re-run sign-in, dashboard, report, and export smoke checks in Production.
- [ ] Confirm monitoring/logs show no auth, database, or CSP errors.
- [ ] Record the prior production deployment and rollback owner.
