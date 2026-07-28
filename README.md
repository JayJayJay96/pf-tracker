# Personal Finance Tracker

Private, online-first finance PWA for monthly planning, personal and shared
expenses, friend payment requests, historical reports, and owner-scoped
exports. Monetary values are stored as integer sen and reports use transaction
dates rather than record-entry timestamps.

## Prerequisites

- Node.js 20.9 or later
- npm
- Docker-compatible local container runtime (for Supabase)
- Supabase CLI (installed by the project package)

## Local development

```bash
npm ci
npx supabase start
npm run dev
```

Copy `.env.example` to `.env.local` and fill the local API URL and publishable
key shown by `npx supabase status`. Never expose or prefix a service-role key
with `NEXT_PUBLIC_`.

## Checks

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:coverage
npx supabase test db
npx playwright install chromium
npm run test:e2e
npm run build
```

## Privacy and offline behavior

Authenticated pages, API responses, and exports stay server-authorized and are
not cached by a service worker. The app currently installs from its web
manifest without registering a service worker. Only unsaved form fields are
stored in local storage, under versioned keys isolated by authenticated user
and form; successful saves clear those drafts.

## Deployment

Use separate Supabase projects/data for Development, Vercel Preview, and
Production. Preview deployments must never connect to production personal
data. See [Supabase and Vercel operations](docs/operations/supabase-and-vercel.md)
and the [release checklist](docs/operations/release-checklist.md).
